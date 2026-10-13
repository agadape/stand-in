import { ed25519 } from "@noble/curves/ed25519.js";
import { fromHex } from "./mera-namespaces";

/**
 * The pet's voice: an Ed25519 key grown from the `standin/pet-voice/v1` passkey namespace.
 * The private half exists only in the owner's browser for the moment it signs; the public
 * half is published. Anyone can check a postcard against it, and nobody without the
 * passkey, this server included, can write one that passes.
 */

/** Exactly what gets signed. The pet's slug is inside, so a postcard cannot be passed off as another pet's. */
export function postcardMessage(slug: string, text: string): Uint8Array {
  return new TextEncoder().encode(`Stand-In postcard\npet: ${slug}\n${text}`);
}

/** True only if `signature` is this key's signature over this exact text for this pet. */
export function verifyPostcard(publicKeyHex: string, slug: string, text: string, signatureHex: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(publicKeyHex) || !/^[0-9a-f]{128}$/.test(signatureHex)) return false;
  try {
    return ed25519.verify(fromHex(signatureHex), postcardMessage(slug, text), fromHex(publicKeyHex));
  } catch {
    return false;
  }
}

/** The public key that goes with a 32-byte seed. Used to show that another namespace's bytes give an unrelated key. */
export function publicKeyOf(seed: Uint8Array): Uint8Array {
  return ed25519.getPublicKey(seed);
}
