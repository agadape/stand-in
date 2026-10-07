"use client";

import { useMemo, useSyncExternalStore } from "react";
import { OWNED_KEY, parseOwned } from "./session";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("standin:session", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("standin:session", onChange);
  };
}

// Returns a string on the client even when nothing is stored, so only the server
// snapshot is `null`; a `null` here would read as "not hydrated yet" and hide the UI.
function snapshot() {
  try {
    return window.localStorage.getItem(OWNED_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * Whether this browser created the twin. Server render and first client render both see
 * `null`, so there's no hydration mismatch; the real value arrives after mount.
 */
export function useIsOwner(slug: string, ownerAddress: string): boolean | null {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  return useMemo(() => {
    if (raw === null) return null;
    const owned = parseOwned(raw)[slug];
    return owned ? owned.ownerAddress.toLowerCase() === ownerAddress.toLowerCase() : false;
  }, [raw, slug, ownerAddress]);
}
