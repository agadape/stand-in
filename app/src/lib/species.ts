/**
 * What kind of creature a pet is. There are eighteen, and which one you get is settled the
 * moment your pet is made: it is worked out from the pet's slug, which ends in random
 * characters, so it is as good as a roll of the dice, never changes afterwards, and needs
 * nothing stored. Made-up townsfolk get theirs from their name the same way.
 *
 * A species is looks only. Every one has the same body, so anything a pet can wear fits
 * all of them, and nothing here touches how a pet talks, scores or behaves.
 */
export type Ears = "round" | "pointed" | "long" | "big" | "floppy" | "none";
export type Extra =
  | "whiskers"
  | "snout"
  | "beak"
  | "horns"
  | "horn"
  | "antennae"
  | "antenna"
  | "gills"
  | "stripes"
  | "bands"
  | "spots"
  | "patches"
  | "muzzle"
  | "bib"
  | "spikes"
  | "bolts"
  | "tuft";

export type Species = {
  id: string;
  name: string;
  /** Body, then the darker tone for ears, arms and feet. */
  body: string;
  deep: string;
  /** Inside of the ears, where a species has one. */
  inner?: string;
  cheeks?: string;
  ears: Ears;
  extras: Extra[];
};

export const SPECIES: Species[] = [
  { id: "bear", name: "Bear", body: "#836EF9", deep: "#6A56E0", ears: "round", extras: [] },
  { id: "cat", name: "Cat", body: "#FFA94D", deep: "#E8853A", inner: "#FFD9E6", ears: "pointed", extras: ["whiskers", "stripes"] },
  { id: "bunny", name: "Bunny", body: "#FBF3F5", deep: "#E9D5DC", inner: "#FF9EC4", ears: "long", extras: ["whiskers"] },
  { id: "fox", name: "Fox", body: "#F2703A", deep: "#B9481C", inner: "#3A2A2A", ears: "pointed", extras: ["muzzle"] },
  { id: "frog", name: "Frog", body: "#5DC264", deep: "#3E9C49", cheeks: "#FFD166", ears: "none", extras: ["spots"] },
  { id: "chick", name: "Chick", body: "#FFD84D", deep: "#F2B01E", ears: "none", extras: ["beak", "tuft"] },
  { id: "panda", name: "Panda", body: "#F6F6F8", deep: "#2B2350", ears: "round", extras: ["patches"] },
  { id: "mouse", name: "Mouse", body: "#A9B0C3", deep: "#8189A0", inner: "#FFB3C7", ears: "big", extras: ["whiskers"] },
  { id: "axolotl", name: "Axolotl", body: "#FFB0CF", deep: "#F27AAE", cheeks: "#FF6FA5", ears: "none", extras: ["gills"] },
  { id: "dragon", name: "Dragon", body: "#2EC4B6", deep: "#1B9C90", inner: "#FFF1C2", ears: "none", extras: ["horns", "spikes"] },
  { id: "alien", name: "Alien", body: "#B6E63A", deep: "#8FC21A", ears: "none", extras: ["antennae", "spots"] },
  { id: "penguin", name: "Penguin", body: "#3D4E6B", deep: "#2A3852", ears: "none", extras: ["bib", "beak"] },
  { id: "koala", name: "Koala", body: "#9FB4C7", deep: "#7F96AB", inner: "#F4F4F6", ears: "big", extras: ["snout"] },
  { id: "pig", name: "Pig", body: "#FFB7C5", deep: "#F58CA3", cheeks: "#FF7A9C", ears: "floppy", extras: ["snout"] },
  { id: "cow", name: "Cow", body: "#FAF6EE", deep: "#4A3B33", inner: "#FFF1C2", ears: "floppy", extras: ["horns", "spots", "snout"] },
  { id: "unicorn", name: "Unicorn", body: "#F1ECFF", deep: "#C9B8FF", inner: "#FF9EC4", ears: "pointed", extras: ["horn", "tuft"] },
  { id: "bee", name: "Bee", body: "#FFC93C", deep: "#2B2350", ears: "none", extras: ["antennae", "bands"] },
  { id: "robot", name: "Robot", body: "#C9D3E0", deep: "#8C9AB0", cheeks: "#7AD7F0", ears: "none", extras: ["bolts", "antenna"] },
];

const BY_ID = new Map(SPECIES.map((s) => [s.id, s]));

/** The species for a pet's slug or a resident's name. Same input, same species, always. */
export function speciesOf(seed: string): Species {
  // FNV-1a: small, and spreads similar strings ("dave-1a2b", "dave-1a2c") well apart.
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return SPECIES[(h >>> 0) % SPECIES.length];
}

export function speciesById(id: string | undefined): Species | undefined {
  return id ? BY_ID.get(id) : undefined;
}
