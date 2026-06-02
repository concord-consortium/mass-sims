import {
  type SetStateAction,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

// ============================================================================
// useStateWithCallback — fires `callback` after every state commit, via useEffect.
// ============================================================================

/**
 * Like `useState`, but `callback` is invoked once after mount and again after every
 * state-change commit. The callback is part of the effect dependency array, so passing a
 * new function identity each render will cause it to fire each render too — memoize with
 * `useCallback` if that's not the intent.
 */
export function useStateWithCallback<T>(
  initialState: T | (() => T),
  callback: (state: T) => void,
): readonly [T, React.Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    callback(state);
  }, [state, callback]);

  return [state, setState] as const;
}

// ============================================================================
// useStateWithCallbackInstant — same as above but synchronous (useLayoutEffect).
// Use when the callback affects layout and must run before paint.
// ============================================================================

export function useStateWithCallbackInstant<T>(
  initialState: T | (() => T),
  callback: (state: T) => void,
): readonly [T, React.Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState(initialState);

  useLayoutEffect(() => {
    callback(state);
  }, [state, callback]);

  return [state, setState] as const;
}

// ============================================================================
// useStateWithCallbackLazy — the setter accepts an optional one-shot callback
// that fires after the next commit and is then cleared.
// ============================================================================

type LazySetState<T> = (newValueOrFn: SetStateAction<T>, callback?: (state: T) => void) => void;

export function useStateWithCallbackLazy<T>(
  initialState: T | (() => T),
): readonly [T, LazySetState<T>] {
  const [value, setValue] = useState(initialState);
  const callbackRef = useRef<((state: T) => void) | null>(null);

  useEffect(() => {
    if (callbackRef.current) {
      callbackRef.current(value);
      callbackRef.current = null;
    }
  }, [value]);

  const setValueWithCallback = useCallback<LazySetState<T>>((newValueOrFn, callback) => {
    callbackRef.current = callback ?? null;
    setValue(newValueOrFn);
  }, []);

  return [value, setValueWithCallback] as const;
}
