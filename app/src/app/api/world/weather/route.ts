import { NextResponse } from "next/server";
import { z } from "zod";
import { OwnerProofBody, provenPet } from "@/lib/owner-route";
import { WEATHER_KINDS } from "@/lib/weather";
import { buyWeather, WorldError } from "@/lib/world";

// A gas top-up for the pet's wallet, then its payment, then the receipt.
export const maxDuration = 60;

// Strict on purpose. The body may say which weather and nothing more: a request that also
// names an agent, a pair or a place is refused outright, not quietly ignored.
const Body = z.strictObject({ ...OwnerProofBody.shape, kind: z.enum(WEATHER_KINDS) });

/**
 * A resident pays to change the weather. It changes the town for everyone for a while;
 * it does not move anyone. Each agent, the payer's own included, answers by its own rules.
 */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: z.flattenError(parsed.error) }, { status: 400 });
  const { kind, ...proof } = parsed.data;
  // The kind is inside the signed action, so a proof for a festival cannot buy a storm.
  const pet = await provenPet(proof, `world:weather:${kind}`, { spendsGas: true });
  if (pet instanceof NextResponse) return pet;
  try {
    return NextResponse.json(await buyWeather(pet, kind));
  } catch (error) {
    if (error instanceof WorldError) return NextResponse.json({ error: error.message, ...error.extra }, { status: error.status });
    throw error;
  }
}
