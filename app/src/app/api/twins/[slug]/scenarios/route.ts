import { NextResponse } from "next/server";
import { pickScenarios } from "@/lib/scenarios";
import { twinBySlug } from "@/lib/twins";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const twin = await twinBySlug(slug);
  if (!twin) return NextResponse.json({ error: "No such twin" }, { status: 404 });
  return NextResponse.json({ scenarios: pickScenarios() });
}
