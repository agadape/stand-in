/**
 * What kind of creature a pet is. There are eighteen, and which one you get is settled the
 * moment your pet is made: it is worked out from the pet's slug, which ends in random
 * characters, so it is as good as a roll of the dice, never changes afterwards, and needs
 * nothing stored. Made-up townsfolk get theirs from their name the same way.
 *
 * A species is looks and movement only. The face sits in the same place on almost all of
 * them, so anything a pet can wear fits, and nothing here touches how a pet talks, scores
 * or behaves.
 */
export type Ears = "round" | "pointed" | "long" | "big" | "floppy" | "none";
export type Shape = "round" | "egg" | "squat" | "pear" | "box";
export type Tail = "nub" | "curl" | "bushy" | "thin" | "pom" | "fin" | "spike" | "curly" | "tuft" | "rainbow" | "stinger" | "none";
export type Wings = "bee" | "bat" | "none";
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
  | "tuft"
  | "mane"
  | "teeth"
  | "topEyes"
  | "thirdEye"
  | "visor"
  | "flippers"
  | "smoke"
  | "zzz"
  | "sparkles";

/** How a species carries itself in the 3D town. */
export type Gait = "walk" | "hop" | "leap" | "hover" | "waddle" | "sway" | "roll";

export type Species = {
  id: string;
  name: string;
  /** Body, then the darker tone for ears, arms and feet. */
  body: string;
  deep: string;
  /** Inside of the ears, where a species has one. */
  inner?: string;
  cheeks?: string;
  shape: Shape;
  ears: Ears;
  tail: Tail;
  wings: Wings;
  extras: Extra[];
  gait: Gait;
};

export const SPECIES: Species[] = [
  { id: "bear", name: "Bear", body: "#836EF9", deep: "#6A56E0", shape: "pear", ears: "round", tail: "nub", wings: "none", extras: [], gait: "walk" },
  { id: "cat", name: "Cat", body: "#FFA94D", deep: "#E8853A", inner: "#FFD9E6", shape: "round", ears: "pointed", tail: "curl", wings: "none", extras: ["whiskers", "stripes"], gait: "walk" },
  { id: "bunny", name: "Bunny", body: "#FBF3F5", deep: "#E9D5DC", inner: "#FF9EC4", shape: "egg", ears: "long", tail: "pom", wings: "none", extras: ["whiskers", "teeth"], gait: "hop" },
  { id: "fox", name: "Fox", body: "#F2703A", deep: "#B9481C", inner: "#3A2A2A", shape: "round", ears: "pointed", tail: "bushy", wings: "none", extras: ["muzzle"], gait: "walk" },
  { id: "frog", name: "Frog", body: "#5DC264", deep: "#3E9C49", cheeks: "#FFD166", shape: "squat", ears: "none", tail: "none", wings: "none", extras: ["topEyes", "spots"], gait: "leap" },
  { id: "chick", name: "Chick", body: "#FFD84D", deep: "#F2B01E", shape: "egg", ears: "none", tail: "none", wings: "none", extras: ["beak", "tuft", "flippers"], gait: "waddle" },
  { id: "panda", name: "Panda", body: "#F6F6F8", deep: "#2B2350", shape: "pear", ears: "round", tail: "nub", wings: "none", extras: ["patches"], gait: "sway" },
  { id: "mouse", name: "Mouse", body: "#A9B0C3", deep: "#8189A0", inner: "#FFB3C7", shape: "round", ears: "big", tail: "thin", wings: "none", extras: ["whiskers", "teeth"], gait: "walk" },
  { id: "axolotl", name: "Axolotl", body: "#FFB0CF", deep: "#F27AAE", cheeks: "#FF6FA5", shape: "squat", ears: "none", tail: "fin", wings: "none", extras: ["gills"], gait: "hover" },
  { id: "dragon", name: "Dragon", body: "#2EC4B6", deep: "#1B9C90", inner: "#FFF1C2", shape: "pear", ears: "none", tail: "spike", wings: "bat", extras: ["horns", "spikes", "smoke"], gait: "walk" },
  { id: "alien", name: "Alien", body: "#B6E63A", deep: "#8FC21A", shape: "egg", ears: "none", tail: "none", wings: "none", extras: ["antennae", "thirdEye", "spots"], gait: "hover" },
  { id: "penguin", name: "Penguin", body: "#3D4E6B", deep: "#2A3852", shape: "egg", ears: "none", tail: "none", wings: "none", extras: ["bib", "beak", "flippers"], gait: "waddle" },
  { id: "koala", name: "Koala", body: "#9FB4C7", deep: "#7F96AB", inner: "#F4F4F6", shape: "pear", ears: "big", tail: "nub", wings: "none", extras: ["snout", "zzz"], gait: "sway" },
  { id: "pig", name: "Pig", body: "#FFB7C5", deep: "#F58CA3", cheeks: "#FF7A9C", shape: "squat", ears: "floppy", tail: "curly", wings: "none", extras: ["snout"], gait: "walk" },
  { id: "cow", name: "Cow", body: "#FAF6EE", deep: "#4A3B33", inner: "#FFF1C2", shape: "round", ears: "floppy", tail: "tuft", wings: "none", extras: ["horns", "spots", "snout"], gait: "walk" },
  { id: "unicorn", name: "Unicorn", body: "#F1ECFF", deep: "#C9B8FF", inner: "#FF9EC4", shape: "round", ears: "pointed", tail: "rainbow", wings: "none", extras: ["horn", "mane", "sparkles"], gait: "hop" },
  { id: "bee", name: "Bee", body: "#FFC93C", deep: "#2B2350", shape: "round", ears: "none", tail: "stinger", wings: "bee", extras: ["antennae", "bands"], gait: "hover" },
  { id: "robot", name: "Robot", body: "#C9D3E0", deep: "#8C9AB0", cheeks: "#7AD7F0", shape: "box", ears: "none", tail: "none", wings: "none", extras: ["bolts", "antenna", "visor"], gait: "roll" },
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
