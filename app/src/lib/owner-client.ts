"use client";

import type { OwnerAction } from "./auth";
import type { OwnerInput } from "./api";
import { signInWithPasskey, signOwnerProof } from "./passkey";
import { useOwned } from "./use-session";

export type MyPet = { slug: string; name: string; ownerAddress: string };

/** The pet this browser made (the first, if several). `undefined` until mounted, `null` if none. */
export function useMyPet(): MyPet | null | undefined {
  const owned = useOwned();
  if (owned === null) return undefined;
  const first = Object.entries(owned)[0];
  return first ? { slug: first[0], name: first[1].name, ownerAddress: first[1].ownerAddress } : null;
}

/** One Face ID: proves this device's passkey owns `pet`, for one action. */
export async function ownerProof(pet: { slug: string; ownerAddress: string }, action: OwnerAction): Promise<OwnerInput> {
  const passkey = await signInWithPasskey();
  try {
    if (passkey.address.toLowerCase() !== pet.ownerAddress.toLowerCase()) {
      throw new Error("That passkey doesn't own your pet on this device.");
    }
    return { slug: pet.slug, address: passkey.address, proof: await signOwnerProof(passkey, pet.slug, action) };
  } finally {
    passkey.end();
  }
}
