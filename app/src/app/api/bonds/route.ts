import { NextResponse } from "next/server";
import { z } from "zod";
import type { Address, Hex } from "viem";
import { verifyOwner } from "@/lib/auth";
import { acceptBond } from "@/lib/bonds";
import { JudgeUnavailableError } from "@/lib/llm";
import { funderStatus } from "@/lib/limits";
import { CodeError, type Code } from "@/lib/met";
import { twinBySlug } from "@/lib/twins";

// The second yes writes the pets' chat (a few model calls at worst) and sends a transaction.
export const maxDuration = 120;

const Body = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  proof: z.object({ issuedAt: z.number(), signature: z.string().regex(/^0x[0-9a-fA-F]+$/) }),
  // A rotating code scanned off `to`'s screen. With one, this single yes completes the bond.
  code: z
    .object({
      issuedAt: z.number().int().positive(),
      nonce: z.string().regex(/^0x[0-9a-fA-F]{16}$/),
      signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
    })
    .optional(),
  gatheringId: z.number().int().nonnegative().default(0),
});

/** `from`'s owner befriends `to`. Completes the bond when `to`'s owner has already said yes. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { from, to, address, proof, code, gatheringId } = parsed.data;
  if (from === to) return NextResponse.json({ error: "That's you." }, { status: 400 });

  const [mine, theirs] = await Promise.all([twinBySlug(from), twinBySlug(to)]);
  if (!mine || !theirs) return NextResponse.json({ error: "No such pet" }, { status: 404 });

  const ok = await verifyOwner({
    slug: from,
    action: `bond:${to}`,
    issuedAt: proof.issuedAt,
    address: address as Address,
    signature: proof.signature as Hex,
    expectedOwner: mine.ownerAddress as Address,
  });
  if (!ok) return NextResponse.json({ error: "Owner proof rejected" }, { status: 401 });

  if (!(await funderStatus()).ok) {
    return NextResponse.json({ error: "The game is out of testnet gas for now. Try again later." }, { status: 503 });
  }

  try {
    const scanned = code ? { code: code as Code, gatheringId } : undefined;
    const bond = await acceptBond(mine, theirs, scanned);
    return NextResponse.json({ bond: { id: bond.id, done: Boolean(bond.completedAt) } });
  } catch (error) {
    if (error instanceof CodeError) return NextResponse.json({ error: error.message }, { status: 410 });
    if (error instanceof JudgeUnavailableError) return NextResponse.json({ error: error.message }, { status: 503 });
    throw error;
  }
}
