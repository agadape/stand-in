import { NextResponse } from "next/server";
import { z } from "zod";
import type { Address, Hex } from "viem";
import { verifyOwner } from "@/lib/auth";
import { explorerTx } from "@/lib/chain";
import { fundDemoPot, readTwin } from "@/lib/contract";
import { twinBySlug } from "@/lib/twins";

const Body = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  proof: z.object({ issuedAt: z.number(), signature: z.string().regex(/^0x[0-9a-fA-F]+$/) }),
});

/** Owner-only: drop demo MON into the twin's pot so a passing challenger gets paid. */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const twin = await twinBySlug(slug);
  if (!twin) return NextResponse.json({ error: "No such twin" }, { status: 404 });

  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { address, proof } = parsed.data;

  const ok = await verifyOwner({
    slug,
    action: "fund",
    issuedAt: proof.issuedAt,
    address: address as Address,
    signature: proof.signature as Hex,
    expectedOwner: twin.ownerAddress as Address,
  });
  if (!ok) return NextResponse.json({ error: "Owner proof rejected" }, { status: 401 });

  const txHash = await fundDemoPot(twin.chainTwinId);
  const onchain = await readTwin(twin.chainTwinId);

  return NextResponse.json({ txHash, txUrl: explorerTx(txHash), potWei: onchain.pot.toString() });
}
