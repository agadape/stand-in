import { NextResponse } from "next/server";
import type { Address } from "viem";
import { explorerTx } from "@/lib/chain";
import { canJoin, joinRoom } from "@/lib/met";
import { OwnerProofBody, provenPet } from "@/lib/owner-route";
import { twinBySlug } from "@/lib/twins";

export const maxDuration = 60;

/** Check: what the contract says about this pet and this room. No signature needed to ask. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const roomId = Number((await params).id);
  const pet = await twinBySlug(new URL(request.url).searchParams.get("slug") ?? "");
  if (!pet || !Number.isInteger(roomId)) return NextResponse.json({ error: "No such pet or room" }, { status: 404 });
  try {
    return NextResponse.json(await canJoin(roomId, pet.twinAddress as Address));
  } catch {
    return NextResponse.json({ error: "No such room" }, { status: 404 });
  }
}

/** Join: the pet's own wallet asks the contract, which lets it in or refuses. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const roomId = Number((await params).id);
  const parsed = OwnerProofBody.safeParse(await request.json());
  if (!parsed.success || !Number.isInteger(roomId)) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const pet = await provenPet(parsed.data, `room:join:${roomId}`, { spendsGas: true });
  if (pet instanceof NextResponse) return pet;

  const status = await canJoin(roomId, pet.twinAddress as Address).catch(() => null);
  if (!status) return NextResponse.json({ error: "No such room" }, { status: 404 });
  if (status.member) return NextResponse.json({ error: "You're already in." }, { status: 409 });
  if (!status.ok) {
    return NextResponse.json(
      { error: `Not yet: ${status.vouches} of the ${status.needed} members you need have met you.`, ...status },
      { status: 403 },
    );
  }
  const txHash = await joinRoom(pet, roomId);
  return NextResponse.json({ txUrl: explorerTx(txHash) });
}
