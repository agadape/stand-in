import { NextResponse } from "next/server";
import { z } from "zod";
import { createRoom } from "@/lib/met";
import { OwnerProofBody, provenPet } from "@/lib/owner-route";

export const maxDuration = 60;

const Body = OwnerProofBody.extend({
  name: z.string().trim().min(2).max(40),
  threshold: z.number().int().min(1).max(20),
  inPersonOnly: z.boolean(),
});

/** A pet opens a room: join only if `threshold` members have met you. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Give the room a name (2 to 40 characters)." }, { status: 400 });
  const pet = await provenPet(parsed.data, "room:create", { spendsGas: true });
  if (pet instanceof NextResponse) return pet;
  const { id } = await createRoom(pet, parsed.data.name, parsed.data.threshold, parsed.data.inPersonOnly);
  return NextResponse.json({ id });
}
