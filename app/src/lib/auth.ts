import { verifyMessage, type Address, type Hex } from "viem";

const MAX_AGE_MS = 10 * 60 * 1000;

/** "bond:<other slug>" is befriending that twin; the other slug is signed so a proof can't be reused on someone else. */
export type OwnerAction =
  | "prove"
  | "fund"
  | `bond:${string}`
  // Showing your rotating code, opening a room or a gathering, joining a room.
  | "code"
  | "room:create"
  | `room:join:${number}`
  | "gathering:create";

/** The exact text a passkey account signs to prove it controls an address for one action. */
export function ownerMessage(slug: string, action: OwnerAction, issuedAt: number) {
  return `Stand-In\nslug: ${slug}\naction: ${action}\nissued: ${issuedAt}`;
}

export async function verifyOwner(params: {
  slug: string;
  action: OwnerAction;
  issuedAt: number;
  address: Address;
  signature: Hex;
  expectedOwner: Address;
}) {
  const { slug, action, issuedAt, address, signature, expectedOwner } = params;
  if (address.toLowerCase() !== expectedOwner.toLowerCase()) return false;
  if (Math.abs(Date.now() - issuedAt) > MAX_AGE_MS) return false;
  return verifyMessage({ address, message: ownerMessage(slug, action, issuedAt), signature });
}
