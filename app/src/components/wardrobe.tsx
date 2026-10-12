"use client";

import Link from "next/link";
import { COSMETICS, type Cosmetic } from "@/lib/cosmetics";
import { useOutfit } from "@/lib/use-outfit";
import { useIsOwner } from "@/lib/use-session";
import { Pet } from "./pet";
import { SocialProgress } from "./pet-scene";

/**
 * What the pet can wear and what each locked item takes. Cosmetics change how the pet
 * looks and nothing else. The owner's choice is kept on their device; everyone else sees
 * the pet in its latest unlocks.
 */
export function Wardrobe({ twin, friends }: { twin: { slug: string; name: string; ownerAddress: string }; friends: number }) {
  const isOwner = useIsOwner(twin.slug, twin.ownerAddress);
  const [outfit, setOutfit] = useOutfit(twin.slug, friends);

  function toggle(c: Cosmetic) {
    const next = { ...outfit };
    if (next[c.slot] === c.id) delete next[c.slot];
    else next[c.slot] = c.id;
    setOutfit(next);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Wardrobe</h1>
        <p className="mt-1 text-muted">
          <Link href={`/t/${twin.slug}`} className="underline decoration-dotted">
            {twin.name}
          </Link>
          &apos;s pet. New things unlock by meeting people, and only by that.
        </p>
      </div>

      <div className="space-y-6 lg:grid lg:grid-cols-[2fr_3fr] lg:items-start lg:gap-10 lg:space-y-0">
      <div className="space-y-6 lg:sticky lg:top-10">
        <Pet outfit={outfit} className="mx-auto w-52 lg:w-72" label={`${twin.name}'s pet in its outfit`} />
        <SocialProgress friends={friends} />
      </div>

      <ul className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        {COSMETICS.map((c) => {
          const open = friends >= c.friends;
          const worn = outfit[c.slot] === c.id;
          const missing = c.friends - friends;
          return (
            <li key={c.id}>
              <button
                type="button"
                disabled={!open || !isOwner}
                onClick={() => toggle(c)}
                aria-pressed={open ? worn : undefined}
                className={`w-full rounded-3xl border p-3 text-center transition ${
                  worn ? "border-accent bg-accent/10" : "border-border bg-card"
                } ${open && isOwner ? "hover:border-accent" : ""} ${open ? "" : "opacity-60"}`}
              >
                <Pet outfit={{ [c.slot]: c.id }} className={`mx-auto w-24 ${open ? "" : "grayscale"}`} />
                <p className="mt-1 font-semibold">{c.name}</p>
                <p className={`text-xs ${worn ? "text-accent" : "text-muted"}`}>
                  {open
                    ? worn
                      ? "Wearing"
                      : isOwner
                        ? "Tap to wear"
                        : "Unlocked"
                    : `Locked: meet ${missing} more ${missing === 1 ? "friend" : "friends"} (${c.friends} in all)`}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
      </div>

      <p className="text-center text-xs text-muted">
        {isOwner
          ? "Your outfit choice is saved on this phone. Other people see your pet in its latest unlocks."
          : `Only ${twin.name} can change this outfit.`}{" "}
        Cosmetics never change a score or a verdict.
      </p>
    </div>
  );
}
