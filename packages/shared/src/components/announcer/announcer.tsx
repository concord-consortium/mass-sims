import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * How long each message stays in the live region before it's cleared. Long enough for a screen
 * reader to pick the text up; short enough that a burst of queued messages plays through promptly.
 */
export const DWELL_MS = 150;
/**
 * Brief blank between consecutive messages. Clearing to "" (rather than overwriting text directly)
 * is what lets an identical consecutive message re-announce — the region genuinely changes "" → X.
 */
export const CLEAR_MS = 50;

export type AnnounceFn = (message: string) => void;

const AnnouncerContext = createContext<AnnounceFn | null>(null);

// A missing provider is a wiring bug, not a runtime error — narration is non-essential, so a
// component rendered outside an <Announcer> (e.g. in isolation in a test) silently drops the
// message rather than throwing.
const noopAnnounce: AnnounceFn = () => {};

/**
 * Returns the `announce(message)` function from the nearest {@link Announcer}. All narration flows
 * through the single shared polite region that Announcer renders, so callers never manage their own
 * `aria-live` element. Outside a provider it's a safe no-op.
 */
export function useAnnounce(): AnnounceFn {
  return useContext(AnnouncerContext) ?? noopAnnounce;
}

export interface AnnouncerProps {
  children?: ReactNode;
}

/**
 * One shared visually-hidden polite live region for a whole sim. Descendants call `useAnnounce()` to
 * push narration through it. `announce()` ENQUEUES rather than overwrites: a single event can emit
 * more than one line, and two calls in the same tick must both be heard — so messages are flushed
 * one at a time (show for a dwell, clear, advance). The queue also drives the re-announce of an
 * identical consecutive string (the clear-to-"" between messages is a real change AT will report).
 */
export function Announcer({ children }: AnnouncerProps) {
  const [message, setMessage] = useState("");
  const queueRef = useRef<string[]>([]);
  const flushingRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
  }, []);

  // Flush one message: show it, hold for the dwell, clear, then a short gap before the next. Runs
  // until the queue drains, at which point it releases the flushing latch.
  const step = useCallback(() => {
    const next = queueRef.current.shift();
    if (next === undefined) {
      flushingRef.current = false;
      return;
    }
    setMessage(next);
    schedule(() => {
      setMessage("");
      schedule(step, CLEAR_MS);
    }, DWELL_MS);
  }, [schedule]);

  const announce = useCallback<AnnounceFn>(
    (msg) => {
      queueRef.current.push(msg);
      // Kick off the flush only if one isn't already running; otherwise the in-flight chain will
      // pick this message up when it next shifts the queue.
      if (!flushingRef.current) {
        flushingRef.current = true;
        step();
      }
    },
    [step],
  );

  // Drop any pending timers (and the queue) if the region unmounts mid-flush, so no setState fires
  // on an unmounted component.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const id of timers) clearTimeout(id);
      timers.length = 0;
      queueRef.current = [];
      flushingRef.current = false;
    };
  }, []);

  return (
    <AnnouncerContext.Provider value={announce}>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {message}
      </div>
      {children}
    </AnnouncerContext.Provider>
  );
}
