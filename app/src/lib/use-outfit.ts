"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { allowedOutfit, defaultOutfit, type Outfit } from "./cosmetics";

const KEY = "standin:outfit";
const EVENT = "standin:outfit";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function snapshot() {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

function parse(raw: string): Record<string, Outfit> {
  try {
    return raw ? (JSON.parse(raw) as Record<string, Outfit>) : {};
  } catch {
    return {};
  }
}

/**
 * What this pet is wearing, and a way to change it. The choice is a per-device
 * convenience kept in this browser; without one (which is everyone but the owner) the
 * pet wears its latest unlocks. Either way nothing locked can be worn.
 */
export function useOutfit(slug: string, friends: number): [Outfit, (next: Outfit) => void] {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const outfit = useMemo(() => {
    const chosen = raw ? parse(raw)[slug] : undefined;
    return chosen ? allowedOutfit(chosen, friends) : defaultOutfit(friends);
  }, [raw, slug, friends]);

  const setOutfit = useCallback(
    (next: Outfit) => {
      try {
        window.localStorage.setItem(KEY, JSON.stringify({ ...parse(snapshot()), [slug]: next }));
        window.dispatchEvent(new Event(EVENT));
      } catch {
        // Blocked storage: the pet keeps its default outfit.
      }
    },
    [slug],
  );

  return [outfit, setOutfit];
}
