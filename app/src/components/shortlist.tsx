"use client";

import { useSyncExternalStore } from "react";
import { useOwned } from "@/lib/use-session";
import { Button } from "./ui";

const KEY = "standin:shortlist";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("standin:shortlist", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("standin:shortlist", onChange);
  };
}

function snapshot() {
  try {
    return window.localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function parse(raw: string): number[] {
  try {
    return JSON.parse(raw) as number[];
  } catch {
    return [];
  }
}

/**
 * A private star on a friend. It lives in this browser only and is never sent anywhere,
 * so the other person can't know. Shown only to someone who is one of the two friends.
 */
export function Shortlist({ bondId, a, b }: { bondId: number; a: { slug: string; name: string }; b: { slug: string; name: string } }) {
  const owned = useOwned();
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  if (!owned || raw === null) return null;
  const other = a.slug in owned ? b : b.slug in owned ? a : null;
  if (!other) return null;

  const starred = parse(raw).includes(bondId);
  function toggle() {
    const list = parse(snapshot());
    const next = starred ? list.filter((id) => id !== bondId) : [...list, bondId];
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
      window.dispatchEvent(new Event("standin:shortlist"));
    } catch {
      // Blocked storage: nothing to remember, nothing to break.
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="secondary" onClick={toggle}>
        {starred ? `★ ${other.name} is on your shortlist` : `☆ Put ${other.name} on your shortlist`}
      </Button>
      <p className="text-center text-xs text-muted">Only you can see your shortlist. It stays on this phone.</p>
    </div>
  );
}
