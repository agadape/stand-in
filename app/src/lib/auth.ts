import { verifyMessage, type Address, type Hex } from "viem";

const MAX_AGE_MS = 10 * 60 * 1000;

/** The exact text a passkey account signs to prove it controls an address for one action. */
export function ownerMessage(slug: string, action: "prove" | "fund", issuedAt: number) {
  return `Stand-In\nslug: ${slug}\naction: ${action}\nissued: ${issuedAt}`;
}

export async function verifyOwner(params: {
  slug: string;
  action: "prove" | "fund";
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
