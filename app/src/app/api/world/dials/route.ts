import { NextResponse } from "next/server";
import { z } from "zod";
import { OwnerProofBody, provenPet } from "@/lib/owner-route";
import { setDials, WorldError } from "@/lib/world";

const Body = OwnerProofBody.extend({
  dials: z.object({
    openness: z.number().min(0).max(100),
    pace: z.number().min(0).max(100),
    avoid: z.string().max(120),
    paused: z.boolean(),
  }),
  interests: z.array(z.string().max(60)).max(12).optional(),
});

/**
 * The only thing an owner can change about their agent's life: its dials and what it
 * cares about. There is no route that tells an agent where to go or what to say.
 */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const pet = await provenPet(parsed.data, "world:dials");
  if (pet instanceof NextResponse) return pet;
  try {
    return NextResponse.json({ dials: await setDials(pet, parsed.data.dials, parsed.data.interests) });
  } catch (error) {
    if (error instanceof WorldError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
