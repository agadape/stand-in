import { NextResponse } from "next/server";
import { z } from "zod";
import type { Address } from "viem";
import { createTwin } from "@/lib/twins";
import { QUIZ } from "@/lib/scenarios";

const Body = z.object({
  name: z.string().trim().min(1).max(40),
  bio: z.string().trim().max(280).default(""),
  ownerAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  samples: z.array(z.string().trim().min(1).max(500)).min(8).max(60),
  quiz: z.array(z.object({ question: z.string(), answer: z.string().trim().min(1).max(300) })).length(QUIZ.length),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { name, bio, ownerAddress, samples, quiz } = parsed.data;

  const twin = await createTwin(ownerAddress as Address, { version: 1, name, bio, samples, quiz });

  return NextResponse.json({
    slug: twin.slug,
    twinAddress: twin.twinAddress,
    chainTwinId: twin.chainTwinId,
    txHash: twin.createTxHash,
  });
}
