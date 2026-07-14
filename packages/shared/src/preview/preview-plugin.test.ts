import type { Connect, ResolvedConfig, ViteDevServer } from "vite";
import { describe, expect, it, vi } from "vitest";
import { widthPreviewPlugin } from "./preview-plugin";

type Middleware = (
  req: Connect.IncomingMessage,
  res: {
    statusCode?: number;
    setHeader: (k: string, v: string) => void;
    end: (body: string) => void;
  },
  next: (err?: Error) => void,
) => void | Promise<void>;

/**
 * Drive the plugin's lifecycle hooks by hand and hand back the pieces a test needs: the middleware
 * it mounted, and the log lines it wrote to the dev-server banner.
 */
function setup(config: { root?: string; base?: string } = {}) {
  // Vite declares its hooks with a `this: MinimalPluginContext` context we don't supply (the plugin
  // never touches `this`). Re-type them as plain functions so they're directly callable in a test.
  const plugin = widthPreviewPlugin() as unknown as {
    configResolved: (c: ResolvedConfig) => void;
    configureServer: (s: ViteDevServer) => void;
  };

  plugin.configResolved({
    root: config.root ?? "/repo/simulations/bananas",
    base: config.base ?? "/",
  } as ResolvedConfig);

  let middleware: Middleware | undefined;
  const logged: string[] = [];
  const basePrintUrls = vi.fn();

  const server = {
    middlewares: {
      use: (_route: string, fn: Middleware) => {
        middleware = fn;
      },
    },
    // Stand in for Vite's HTML transform (which injects the client + refresh preamble).
    transformIndexHtml: vi.fn(async (_url: string, html: string) => `<!--transformed-->${html}`),
    printUrls: basePrintUrls,
    resolvedUrls: { local: ["http://localhost:8081/"], network: [] },
    config: { logger: { info: (msg: string) => logged.push(msg) } },
  } as unknown as ViteDevServer;

  plugin.configureServer(server);
  if (!middleware) throw new Error("plugin did not mount a middleware");

  /** Issue a request through the mounted middleware. Returns the response, or null if it deferred. */
  async function request(url: string) {
    let nexted = false;
    const headers: Record<string, string> = {};
    let body: string | undefined;
    const res = {
      statusCode: undefined as number | undefined,
      setHeader: (k: string, v: string) => {
        headers[k] = v;
      },
      end: (b: string) => {
        body = b;
      },
    };
    await middleware?.({ url } as Connect.IncomingMessage, res, () => {
      nexted = true;
    });
    return nexted ? null : { status: res.statusCode, headers, body: body ?? "" };
  }

  return { plugin, server, request, logged, basePrintUrls };
}

describe("widthPreviewPlugin", () => {
  it("only applies to the dev server, so it can never reach a production build", () => {
    expect(widthPreviewPlugin().apply).toBe("serve");
  });

  it("serves the preview shell at the mounted route", async () => {
    const { request } = setup();

    // Connect strips the mounted prefix, so `/__preview` arrives as "/".
    const res = await request("/");

    expect(res).not.toBeNull();
    expect(res?.status).toBe(200);
    expect(res?.headers["Content-Type"]).toBe("text/html");
    expect(res?.body).toContain("<!--transformed-->");
    expect(res?.body).toContain('id="preview-root"');
  });

  it("serves the shell for a trailing slash or a query string too", async () => {
    const { request } = setup();

    expect(await request("")).not.toBeNull();
    expect(await request("/?zoom=0.5")).not.toBeNull();
  });

  it("defers any deeper path, so the sim's own assets still resolve", async () => {
    const { request } = setup();

    expect(await request("/nested")).toBeNull();
    expect(await request("/index.html")).toBeNull();
  });

  it("points the page's module script at this package's preview entry, over Vite's /@fs/ prefix", async () => {
    const { request } = setup();

    const res = await request("/");

    expect(res?.body).toMatch(
      /<script type="module" src="\/@fs\/.*\/preview\/main\.tsx"><\/script>/,
    );
  });

  it("captions the page with the sim's directory name", async () => {
    const { request } = setup({ root: "/repo/simulations/bananas" });

    const res = await request("/");

    expect(res?.body).toContain('data-sim-name="bananas"');
    expect(res?.body).toContain("<title>bananas — width preview</title>");
  });

  it("hands the page an absolute sim URL, so iframes don't resolve against the page's own path", async () => {
    // A relative "./index.html" would resolve to /__preview/index.html when the page is loaded with
    // a trailing slash. The plugin passes an absolute URL instead.
    const { request } = setup({ base: "/" });

    const res = await request("/");

    expect(res?.body).toContain('data-sim-url="/index.html"');
  });

  it("normalizes the relative base sims use for production builds", async () => {
    // Sims set `base: "./"` so built bundles are relocatable. That must not yield a relative iframe
    // URL in dev.
    const { request } = setup({ base: "./" });

    const res = await request("/");

    expect(res?.body).toContain('data-sim-url="/index.html"');
  });

  it("advertises the route in the dev-server banner without suppressing Vite's own URLs", () => {
    const { server, logged, basePrintUrls } = setup();

    server.printUrls();

    expect(basePrintUrls).toHaveBeenCalledOnce();
    expect(logged.join("\n")).toContain("http://localhost:8081/__preview");
  });
});
