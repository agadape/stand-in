import { NextResponse } from "next/server";
import { z } from "zod";
import { CODE_SHOWN_MS, getGathering, issueCodes } from "@/lib/met";
import { OwnerProofBody, provenPet } from "@/lib/owner-route";

const Body = OwnerProofBody.omit({ slug: true }).extend({ gatheringId: z.number().int().nonnegative().default(0) });

/**
 * Owner-only: the next ten minutes of rotating codes for this pet. Only the owner's
 * passkey can fetch them, which is what makes a fresh code mean "the owner is showing
 * their phone right now".
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const pet = await provenPet({ slug, ...parsed.data }, "code");
  if (pet instanceof NextResponse) return pet;

  const { gatheringId } = parsed.data;
  let gathering = null;
  if (gatheringId) {
    gathering = await getGathering(gatheringId);
    if (!gathering?.open) {
      return NextResponse.json({ error: "That gathering isn't running right now." }, { status: 409 });
    }
  }
  return NextResponse.json({
    codes: await issueCodes(pet, gatheringId),
    shownMs: CODE_SHOWN_MS,
    gathering: gathering && { id: gathering.id, name: gathering.name },
  });
}
