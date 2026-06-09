import { log } from "@concord-consortium/lara-interactive-api";
import { useCallback } from "react";

const EVENT_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;
const MAX_EVENT_NAME_LEN = 40;
const MAX_PARAM_KEYS = 25;
const MAX_PARAM_VALUE_LEN = 100;

declare global {
  // gtag is loaded via the gtag.js snippet injected at build time when
  // VITE_GA_PROPERTY_ID is set; undefined when GA is disabled.
  interface Window {
    gtag?: (command: "event", name: string, params?: Record<string, unknown>) => void;
  }
}

export type LogEvent = (eventName: string, parameters?: Record<string, unknown>) => void;

/**
 * Dual-transport action logging. Returns a stable function that:
 *
 *  1. Validates the event name and params against GA4's constraints (snake_case,
 *     ≤ 40-char names, ≤ 25 params, ≤ 100-char values). In dev, validation
 *     failures throw — misnamed events get caught at the source.
 *  2. Forwards the event to `@concord-consortium/lara-interactive-api`'s `log()`,
 *     which fires into portal-report when embedded and no-ops when standalone.
 *  3. Forwards the event to `window.gtag('event', …)` when GA is configured
 *     (gtag.js loaded by the build-time-injected snippet in index.html).
 *
 * The two transports are independent: when GA is disabled, portal-report still
 * gets the event; when standalone (not embedded), GA still gets it. Both
 * transports are silent no-ops when their transport isn't available.
 *
 * See infrastructure-plan.md §5 and §11 #27–#32 for the contract.
 */
export function useLogEvent(): LogEvent {
  return useCallback((eventName, parameters) => {
    validate(eventName, parameters);
    try {
      // lara-interactive-api log(action, data): event name → action, params → data.
      log(eventName, parameters);
    } catch {
      // lara-interactive-api throws if it hasn't initialized — treat as no-op.
    }
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", eventName, parameters);
    }
  }, []);
}

function validate(eventName: string, parameters?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  if (!EVENT_NAME_PATTERN.test(eventName)) {
    throw new Error(
      `useLogEvent: event name "${eventName}" must be snake_case (lowercase, digits, underscores; starting with a letter).`,
    );
  }
  if (eventName.length > MAX_EVENT_NAME_LEN) {
    throw new Error(
      `useLogEvent: event name "${eventName}" exceeds 40 chars (${eventName.length}).`,
    );
  }
  if (parameters) {
    const keys = Object.keys(parameters);
    if (keys.length > MAX_PARAM_KEYS) {
      throw new Error(
        `useLogEvent: event "${eventName}" has ${keys.length} params (max 25 params).`,
      );
    }
    for (const key of keys) {
      const value = parameters[key];
      if (typeof value === "string" && value.length > MAX_PARAM_VALUE_LEN) {
        throw new Error(
          `useLogEvent: event "${eventName}" param "${key}" value exceeds 100 chars.`,
        );
      }
    }
  }
}
