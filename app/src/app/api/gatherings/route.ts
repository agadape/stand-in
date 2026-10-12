import { NextResponse } from "next/server";
import { z } from "zod";
import { createGathering } from "@/lib/met";
import { OwnerProofBody, provenPet } from "@/lib/owner-route";

export const maxDuration = 60;

const Body = OwnerProofBody.extend({
  name: z.string().trim().min(2).max(60),
  hours: z.number().min(0.5).max(72),
});

/** A pet hosts a gathering that starts now and runs for `hours`. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Give it a name and a length between half an hour and three days." }, { status: 400 });
  const pet = await provenPet(parsed.data, "gathering:create", { spendsGas: true });
  if (pet instanceof NextResponse) return pet;
  const { id } = await createGathering(pet, parsed.data.name, parsed.data.hours);
  return NextResponse.json({ id });
}
