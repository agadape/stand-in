"use client";

import { useState } from "react";
import { nextUnlock } from "@/lib/cosmetics";
import { useOutfit } from "@/lib/use-outfit";
import { Pet, type Mood } from "./pet";

const TAPS: Mood[] = ["happy", "shocked", "suspicious"];

/**
 * A pet in what it is wearing. Tapping it gets a short reaction and nothing else: the pet
 * is a character, not a chatbot.
 */
export function PetScene({
  slug,
  name,
  friends,
  mood = "idle",
  className = "w-48",
}: {
  slug: string;
  name: string;
  friends: number;
  mood?: Mood;
  className?: string;
}) {
  const [outfit] = useOutfit(slug, friends);
  const [tap, setTap] = useState<{ n: number; mood: Mood } | null>(null);

  function react() {
    const n = (tap?.n ?? -1) + 1;
    setTap({ n, mood: TAPS[n % TAPS.length] });
    setTimeout(() => setTap((t) => (t?.n === n ? null : t)), 1400);
  }

  return (
    <button type="button" onClick={react} className={`mx-auto block rounded-full outline-offset-4 ${className}`} aria-label={`${name}'s pet. Tap for a reaction.`}>
      {/* The key restarts the hop animation on every tap. */}
      <Pet key={tap?.n ?? "rest"} mood={tap?.mood ?? mood} outfit={outfit} seed={slug} />
    </button>
  );
}

/** Friends met and what the next one unlocks. Counts completed meetings only. */
export function SocialProgress({ friends }: { friends: number }) {
  const next = nextUnlock(friends);
  const pctDone = next ? Math.min(100, (friends / next.friends) * 100) : 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-extrabold">
          {next ? `${friends} / ${next.friends} friends met` : `${friends} friends met`}
        </span>
        <span className="rounded-full bg-[#fff1c2] px-2 py-0.5 text-xs font-extrabold text-[#a86e00]">{next ? `🎁 Next: ${next.name}` : "🎉 Everything unlocked"}</span>
      </div>
      <div className="h-3.5 w-full overflow-hidden rounded-full bg-border" role="progressbar" aria-valuemin={0} aria-valuemax={next?.friends ?? friends} aria-valuenow={friends}>
        <div className="h-full rounded-full bg-gradient-to-r from-accent to-[#8ee000] transition-all duration-700" style={{ width: `${Math.max(pctDone, 4)}%` }} />
      </div>
    </div>
  );
}
