/**
 * The PRF namespaces this app asks a passkey for. A namespace is a label; its salt is the
 * SHA-256 of that label, and Mera hands back 32 bytes that only this passkey can produce
 * for that salt. Different salt, unrelated bytes: learning one namespace's output tells
 * you nothing about the account key or about any other namespace.
 *
 * The account itself uses Mera's built-in default salt and lives in lib/passkey.ts. The
 * ones here do work that has nothing to do with an account or a wallet.
 */
export const NAMESPACES = {
  /** Grows the pet's birthmark: a look that is derived, never chosen and never stored as a secret. */
  dna: "standin/pet-dna/v1",
  /** The pet's voice: an Ed25519 key that signs its postcards, so nobody else can write as it. */
  voice: "standin/pet-voice/v1",
} as const;

/** The label Mera hashes for its own default salt, shown on the keys page for comparison. */
export const MERA_DEFAULT_LABEL = "mera.prf.salt.v1";

const bytesOf = (text: string) => new TextEncoder().encode(text);

export async function sha256(...parts: Uint8Array[]): Promise<Uint8Array> {
  const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.length;
  }
  return new Uint8Array(await crypto.subtle.digest("SHA-256", all));
}

/** The 32-byte PRF salt for a namespace label. */
export function ns(label: string): Promise<Uint8Array> {
  return sha256(bytesOf(label));
}

export const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
export const fromHex = (hex: string) => new Uint8Array((hex.match(/.{2}/g) ?? []).map((h) => parseInt(h, 16)));

/** A one-way tag of some bytes under a purpose, safe to show: it cannot be turned back into them. */
export async function fingerprint(purpose: string, bytes: Uint8Array): Promise<string> {
  return toHex(await sha256(bytesOf(`standin:${purpose}:`), bytes)).slice(0, 16);
}
