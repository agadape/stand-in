import { fingerprint, sha256 } from "./mera-namespaces";

/**
 * A pet's birthmark, grown from 32 bytes that only its owner's passkey can produce (the
 * `standin/pet-dna/v1` namespace). Nothing here is chosen by anyone and the bytes are
 * never stored: the same passkey regrows the same mark on any device.
 *
 * The traits are read from a hash of the seed, not from the seed, so publishing a pet's
 * mark gives away nothing that could rebuild the seed or lead to any other key.
 */
export type Birthmark = {
  /** A short one-way tag of the seed: two marks match exactly when these do. */
  fingerprint: string;
  /** Two hues, 0 to 359. */
  hue: number;
  hue2: number;
  /** The frame around the mark: 0 circle, 1 diamond, 2 hexagon, 3 shield. */
  shape: number;
  /** A 5 by 5 pattern, mirrored left to right: 15 bits, one per cell of the left three columns. */
  cells: number;
  /** How many rays stand around it, 3 to 9. */
  rays: number;
};

export async function birthmarkOf(seed: Uint8Array): Promise<Birthmark> {
  if (seed.length !== 32) throw new Error("A pet's genome is 32 bytes");
  const d = await sha256(new TextEncoder().encode("standin:dna:traits:"), seed);
  const hue = ((d[0] << 8) | d[1]) % 360;
  // The second hue sits well away from the first, so the pattern always reads.
  const hue2 = (hue + 90 + (((d[2] << 8) | d[3]) % 180)) % 360;
  let cells = ((d[4] << 8) | d[5]) & 0x7fff;
  // Never an empty or a full square: at least four cells on and four off.
  const on = cells.toString(2).replace(/0/g, "").length;
  if (on < 4) cells |= 0b010101010101010;
  if (on > 11) cells &= 0b101010101011111;
  return { fingerprint: await fingerprint("dna", seed), hue, hue2, shape: d[6] % 4, cells, rays: 3 + (d[7] % 7) };
}

/** Whether a value read from storage or the network has the shape of a birthmark. */
export function isBirthmark(v: unknown): v is Birthmark {
  if (!v || typeof v !== "object") return false;
  const m = v as Record<string, unknown>;
  const int = (x: unknown, lo: number, hi: number) => typeof x === "number" && Number.isInteger(x) && x >= lo && x <= hi;
  return typeof m.fingerprint === "string" && /^[0-9a-f]{16}$/.test(m.fingerprint) && int(m.hue, 0, 359) && int(m.hue2, 0, 359) && int(m.shape, 0, 3) && int(m.cells, 0, 0x7fff) && int(m.rays, 3, 9);
}
