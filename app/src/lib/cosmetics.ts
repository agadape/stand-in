/**
 * What a pet can wear. Cosmetics are looks only: nothing here touches judging or scores.
 * Each unlocks at a number of friends met, which is counted from completed meetings
 * (every one of them a ProofOfMet transaction), never from clicks or invites.
 */
export type Slot = "neck" | "face" | "head" | "aura";

export type Cosmetic = { id: string; slot: Slot; name: string; friends: number };

export const COSMETICS: Cosmetic[] = [
  { id: "bowtie", slot: "neck", name: "Bow tie", friends: 1 },
  { id: "glasses", slot: "face", name: "Round glasses", friends: 2 },
  { id: "partyhat", slot: "head", name: "Party hat", friends: 3 },
  { id: "crown", slot: "head", name: "Crown", friends: 5 },
  { id: "aura", slot: "aura", name: "Sparkle aura", friends: 8 },
];

/** One cosmetic id per slot. */
export type Outfit = Partial<Record<Slot, string>>;

export function unlocked(friends: number) {
  return COSMETICS.filter((c) => friends >= c.friends);
}

/** The next thing to earn, or null when everything is unlocked. */
export function nextUnlock(friends: number): Cosmetic | null {
  return COSMETICS.find((c) => friends < c.friends) ?? null;
}

/**
 * What a pet wears when its owner hasn't chosen: the latest unlock in each slot. Outfit
 * choices are kept on the owner's device, so this is also what everyone else sees.
 */
export function defaultOutfit(friends: number): Outfit {
  const outfit: Outfit = {};
  for (const c of unlocked(friends)) outfit[c.slot] = c.id;
  return outfit;
}

/** Drops anything not unlocked or not in its own slot, so a stored outfit can't cheat. */
export function allowedOutfit(outfit: Outfit, friends: number): Outfit {
  const ok = new Map(unlocked(friends).map((c) => [c.id, c.slot]));
  const out: Outfit = {};
  for (const [slot, id] of Object.entries(outfit) as [Slot, string][]) {
    if (ok.get(id) === slot) out[slot] = id;
  }
  return out;
}
