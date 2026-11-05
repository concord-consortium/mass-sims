// The landing page's behavior. Plain browser JavaScript, no build step: scripts/gen-index.ts inlines
// it in a <script> at the end of <body>, after the sims JSON block it reads.

(() => {
  const sims = JSON.parse(document.getElementById("sims").textContent);
  const buttons = document.querySelectorAll(".sim-button");
  const panel = document.querySelector(".sim-panel");
  const frame = document.querySelector(".sim-frame");
  const shareName = document.getElementById("share-name");
  const liveRegion = document.querySelector(".share [aria-live]");
  const shareButtons = document.querySelectorAll(".share-button");

  const COPIED_MS = 1400;
  let current = sims[0];

  function simUrl(sim) {
    return new URL(`./${sim.name}/index.html`, window.location.href).href;
  }

  function escapeAttr(s) {
    return s
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function embedCode(sim) {
    return (
      `<iframe src="${escapeAttr(simUrl(sim))}" width="1024" height="562" ` +
      `frameborder="0" allowfullscreen title="${escapeAttr(sim.title)}"></iframe>`
    );
  }

  function setPanelColors(colors) {
    panel.style.setProperty("--sim-surface", colors.surface);
    panel.style.setProperty("--sim-text", colors.text);
    panel.style.setProperty("--sim-border", colors.border);
    panel.style.setProperty("--sim-hover", colors.hover);
    panel.style.setProperty("--sim-active", colors.active);
    panel.style.setProperty("--sim-selected-text", colors.selectedText);
  }

  function select(sim) {
    current = sim;
    for (const button of buttons) {
      button.setAttribute("aria-pressed", String(button.dataset.sim === sim.name));
    }
    frame.src = `./${sim.name}/index.html?standalone=true`;
    frame.title = `${sim.title} simulation`;
    setPanelColors(sim.colors);
    shareName.textContent = sim.title;
  }

  for (const button of buttons) {
    button.addEventListener("click", () => {
      const sim = sims.find((s) => s.name === button.dataset.sim);
      if (!sim || sim === current) return;
      select(sim);
      const url = new URL(window.location.href);
      url.searchParams.set("sim", sim.name);
      window.history.replaceState(null, "", url);
    });
  }

  // ?sim=<folder> selects a sim on load; an unknown value is ignored.
  const requested = sims.find(
    (s) => s.name === new URLSearchParams(window.location.search).get("sim"),
  );
  if (requested && requested !== sims[0]) select(requested);

  // ---- Share row ----

  // Cleared first, then set on the next frame, so the same message twice is announced twice.
  function announce(message) {
    liveRegion.textContent = "";
    requestAnimationFrame(() => {
      liveRegion.textContent = message;
    });
  }

  // For browsers without the async clipboard, or where it is refused (e.g. no permission). Throws
  // when this copy fails too, so the caller does not report a copy that did not happen.
  function copyWithTextarea(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.cssText = "position:fixed;top:-1000px;opacity:0;";
    document.body.appendChild(textarea);
    textarea.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      // Treated as a failure below.
    }
    textarea.remove();
    if (!ok) throw new Error("copy failed");
  }

  // Resolves once the text is on the clipboard; rejects if neither way of copying worked.
  function copyText(text) {
    if (navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(text).catch(() => copyWithTextarea(text));
    }
    return Promise.resolve().then(() => copyWithTextarea(text));
  }

  // Swap the label to "Copied" for a moment. The button's width is frozen (below), so it does not
  // resize under the pointer.
  const restoreTimers = new Map();
  function showCopied(button) {
    const label = button.querySelector(".share-label");
    const original = label.dataset.label ?? label.textContent;
    label.dataset.label = original;
    label.textContent = "Copied";
    clearTimeout(restoreTimers.get(button));
    restoreTimers.set(
      button,
      setTimeout(() => {
        label.textContent = original;
      }, COPIED_MS),
    );
  }

  const actions = {
    open: () => window.open(simUrl(current), "_blank", "noopener"),
    // A failed copy shows nothing: both ways of copying failing is very rare.
    "copy-url": (button) => {
      const sim = current;
      copyText(simUrl(sim))
        .then(() => {
          showCopied(button);
          announce(`${sim.title} URL copied`);
        })
        .catch(() => {});
    },
    "copy-embed": (button) => {
      const sim = current;
      copyText(embedCode(sim))
        .then(() => {
          showCopied(button);
          announce(`${sim.title} embed code copied`);
        })
        .catch(() => {});
    },
  };

  for (const button of shareButtons) {
    button.addEventListener("click", () => actions[button.dataset.action](button));
  }

  // Freeze the share row's widths once the fonts have loaded: each button at its own width, and
  // the sim name at the width of the longest title, so every name ends at the same point.
  function freezeWidths() {
    const shown = shareName.textContent;
    let widest = 0;
    for (const sim of sims) {
      shareName.textContent = sim.title;
      widest = Math.max(widest, shareName.getBoundingClientRect().width);
    }
    shareName.textContent = shown;
    if (widest > 0) shareName.style.width = `${Math.ceil(widest)}px`;
    for (const button of shareButtons) {
      const width = button.getBoundingClientRect().width;
      if (width > 0) button.style.width = `${Math.ceil(width)}px`;
    }
  }
  if (document.fonts) document.fonts.ready.then(freezeWidths);
  else requestAnimationFrame(freezeWidths);

  // ---- Footer ----

  // The deploy path says which build this is: /version/<tag>/ or /branch/<name>/. A branch name
  // can contain "/" (feature/demo is deployed at /branch/feature/demo/), so the name runs to the
  // end of the path. The top level shows no version.
  const deploy = window.location.pathname.match(/\/(version|branch)\/(.+?)\/(index\.html)?$/);
  if (deploy) {
    const name = decodeURIComponent(deploy[2]);
    const version = document.querySelector(".footer-version");
    version.textContent =
      deploy[1] === "version" ? `MassSims ${name}` : `MassSims (branch ${name})`;
    version.hidden = false;
    document.querySelector(".footer-version-sep").hidden = false;
  }
  document.querySelector(".footer-year").textContent = String(new Date().getFullYear());
})();
