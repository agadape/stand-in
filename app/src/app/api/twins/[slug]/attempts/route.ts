import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import type { Address, Hex } from "viem";
import { verifyOwner } from "@/lib/auth";
import { explorerTx } from "@/lib/chain";
import { postOwnerProof, postVerdict } from "@/lib/contract";
import { db, schema } from "@/lib/db";
import { judge } from "@/lib/judge";
import { ANSWERS_PER_ATTEMPT, scenarioById } from "@/lib/scenarios";
import { twinBySlug } from "@/lib/twins";

const Body = z.object({
  mode: z.enum(["owner", "challenger"]),
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  displayName: z.string().trim().min(1).max(40),
  scenarioIds: z.array(z.string()).length(ANSWERS_PER_ATTEMPT),
  answers: z.array(z.string().trim().min(1).max(400)).length(ANSWERS_PER_ATTEMPT),
  // Owners prove control of the twin's owner address with a passkey signature.
  proof: z.object({ issuedAt: z.number(), signature: z.string().regex(/^0x[0-9a-fA-F]+$/) }).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const twin = await twinBySlug(slug);
  if (!twin) return NextResponse.json({ error: "No such twin" }, { status: 404 });

  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { mode, address, displayName, scenarioIds, answers, proof } = parsed.data;

  const scenarios = scenarioIds.map(scenarioById);
  if (scenarios.some((s) => !s)) return NextResponse.json({ error: "Unknown scenario" }, { status: 400 });

  if (mode === "owner") {
    if (!proof) return NextResponse.json({ error: "Owner proof required" }, { status: 401 });
    const ok = await verifyOwner({
      slug,
      action: "prove",
      issuedAt: proof.issuedAt,
      address: address as Address,
      signature: proof.signature as Hex,
      expectedOwner: twin.ownerAddress as Address,
    });
    if (!ok) return NextResponse.json({ error: "Owner proof rejected" }, { status: 401 });
  } else {
    if (address.toLowerCase() === twin.ownerAddress.toLowerCase()) {
      return NextResponse.json({ error: "You can't challenge your own twin. Use owner mode." }, { status: 400 });
    }
    if (!twin.ownerProven) {
      return NextResponse.json({ error: `${twin.name} hasn't proven they're themselves yet.` }, { status: 409 });
    }
  }

  const verdict = await judge(twin.persona, scenarios.map((s) => s!), answers);

  let txHash: Hex;
  let paidWei = 0n;
  let passed: boolean;

  if (mode === "owner") {
    txHash = await postOwnerProof(slug, twin.chainTwinId, verdict.scoreBps, verdict.verdictHash);
    passed = true;
    await db()
      .update(schema.twins)
      .set({ ownerProven: true, ownerScoreBps: verdict.scoreBps })
      .where(eq(schema.twins.id, twin.id));
  } else {
    const result = await postVerdict(slug, twin.chainTwinId, address as Address, verdict.scoreBps, verdict.verdictHash);
    txHash = result.txHash;
    paidWei = result.paidWei;
    passed = verdict.scoreBps > twin.ownerScoreBps;
  }

  const attempt = await db()
    .insert(schema.attempts)
    .values({
      twinId: twin.id,
      mode,
      address,
      displayName,
      scenarioIds,
      answers,
      llm: verdict.llm,
      style: verdict.style,
      scoreBps: verdict.scoreBps,
      passed,
      verdictHash: verdict.verdictHash,
      txHash,
      paidWei: paidWei.toString(),
      createdAt: new Date(),
    })
    .returning()
    .get();

  return NextResponse.json({
    attempt: {
      id: attempt.id,
      mode,
      scoreBps: verdict.scoreBps,
      ownerScoreBps: mode === "owner" ? verdict.scoreBps : twin.ownerScoreBps,
      passed,
      paidWei: paidWei.toString(),
      llm: verdict.llm,
      styleNotes: verdict.style.notes,
      styleSimilarity: verdict.style.similarity,
      verdictHash: verdict.verdictHash,
      txHash,
      txUrl: explorerTx(txHash),
    },
  });
}
