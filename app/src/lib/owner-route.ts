import { NextResponse } from "next/server";
import { z } from "zod";
import type { Address, Hex } from "viem";
import { verifyOwner, type OwnerAction } from "./auth";
import type { Twin } from "./db/schema";
import { funderStatus } from "./limits";
import { twinBySlug } from "./twins";

/** The owner-proof part every owner-only request body carries. */
export const OwnerProofBody = z.object({
  slug: z.string().min(1),
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  proof: z.object({ issuedAt: z.number(), signature: z.string().regex(/^0x[0-9a-fA-F]+$/) }),
});

/**
 * The pet named in the body, once its owner's passkey signature for `action` checks out.
 * Returns the error response instead when it doesn't.
 */
export async function provenPet(
  body: z.infer<typeof OwnerProofBody>,
  action: OwnerAction,
  { spendsGas = false } = {},
): Promise<Twin | NextResponse> {
  const pet = await twinBySlug(body.slug);
  if (!pet) return NextResponse.json({ error: "No such pet" }, { status: 404 });
  const ok = await verifyOwner({
    slug: body.slug,
    action,
    issuedAt: body.proof.issuedAt,
    address: body.address as Address,
    signature: body.proof.signature as Hex,
    expectedOwner: pet.ownerAddress as Address,
  });
  if (!ok) return NextResponse.json({ error: "Owner proof rejected" }, { status: 401 });
  if (spendsGas && !(await funderStatus()).ok) {
    return NextResponse.json({ error: "The game is out of testnet gas for now. Try again later." }, { status: 503 });
  }
  return pet;
}
