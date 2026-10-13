"use client";

import type { OwnerAction } from "./auth";
import type { OwnerInput } from "./api";
import { forgetPasskey, signInWithPasskey, signOwnerProof, type PasskeyAccount } from "./passkey";
import { forgetOwned } from "./session";
import { useOwned } from "./use-session";

export type MyPet = { slug: string; name: string; ownerAddress: string };

/** The pet this browser made (the first, if several). `undefined` until mounted, `null` if none. */
export function useMyPet(): MyPet | null | undefined {
  const owned = useOwned();
  if (owned === null) return undefined;
  const first = Object.entries(owned)[0];
  return first ? { slug: first[0], name: first[1].name, ownerAddress: first[1].ownerAddress } : null;
}

/**
 * Signs in with a passkey account that is already unlocked: it signs "session" for the
 * pet and the server sets the cookie that opens the world. No extra prompt.
 */
export async function startSession(passkey: PasskeyAccount, slug: string) {
  const proof = await signOwnerProof(passkey, slug, "session");
  const res = await fetch("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ slug, address: passkey.address, proof }),
  });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `Couldn't sign in (${res.status})`);
}

/**
 * Signs this browser out: the session cookie goes, and so does what the device remembers
 * (its pets and which passkey it last used), so the next visit starts as a visitor and the
 * next prompt offers every passkey. With a slug, only that pet is forgotten.
 */
export async function signOut(slug?: string) {
  await fetch("/api/session", { method: "DELETE" }).catch(() => undefined);
  forgetOwned(slug);
  forgetPasskey();
}

/** One Face ID: proves this device's passkey owns `pet`, for one action. */
export async function ownerProof(pet: { slug: string; ownerAddress: string }, action: OwnerAction): Promise<OwnerInput> {
  const passkey = await signInWithPasskey();
  try {
    if (passkey.address.toLowerCase() !== pet.ownerAddress.toLowerCase()) {
      forgetPasskey();
      throw new Error("That passkey doesn't own your pet on this device. Try again and choose the passkey you made this pet with.");
    }
    return { slug: pet.slug, address: passkey.address, proof: await signOwnerProof(passkey, pet.slug, action) };
  } finally {
    passkey.end();
  }
}
