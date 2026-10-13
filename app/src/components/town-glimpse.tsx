"use client";

import { useEffect, useRef, useState } from "react";
import type { TownScene } from "./town-scene";

/**
 * A glimpse of the town for someone who has not come in yet: the empty island at dusk,
 * slowly turning, blurred and dimmed behind the landing page's way in. It shows no
 * residents and asks the server for nothing, so it gives away nothing about the world
 * inside. If 3D is unavailable it is simply a dusk-coloured backdrop.
 */
export function TownGlimpse() {
  const host = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    let scene: TownScene | null = null;
    let cancelled = false;
    // Let the page's words and button arrive first; the scenery can follow.
    const start = setTimeout(() => {
      import("./town-scene")
        .then(({ TownScene }) => {
          if (cancelled || !host.current) return;
          scene = new TownScene(host.current, () => {}, true);
          setOn(true);
        })
        .catch(() => undefined);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(start);
      scene?.dispose();
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-b from-[#4a4fa8] via-[#ff9a6b] to-[#6fbf5a]" aria-hidden>
      <div ref={host} className={`absolute -inset-6 scale-110 blur-[7px] transition-opacity duration-1000 ${on ? "opacity-100" : "opacity-0"}`} />
      {/* A veil, so the words are readable and the town stays a hint. */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1b1740]/55 via-[#1b1740]/35 to-[#1b1740]/75" />
    </div>
  );
}
