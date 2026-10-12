import { NextResponse } from "next/server";
import { z } from "zod";
import { OwnerProofBody, provenPet } from "@/lib/owner-route";
import { consent, WorldError } from "@/lib/world";

// When this is the second yes between two pets, it also sends a transaction.
export const maxDuration = 60;

const Body = OwnerProofBody.extend({ pairId: z.number().int().positive() });

/** One human's yes to being introduced. Nothing is revealed or recorded until both have said it. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const pet = await provenPet(parsed.data, `world:consent:${parsed.data.pairId}`, { spendsGas: true });
  if (pet instanceof NextResponse) return pet;
  try {
    const pair = await consent(pet, parsed.data.pairId);
    return NextResponse.json({ introduced: pair.introducedAt !== null, aConsent: pair.aConsent, bConsent: pair.bConsent });
  } catch (error) {
    if (error instanceof WorldError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
