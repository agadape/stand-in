import { NextResponse } from "next/server";
import { leaderboardRows, publicTwin, twinBySlug } from "@/lib/twins";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const twin = await twinBySlug(slug);
  if (!twin) return NextResponse.json({ error: "No such twin" }, { status: 404 });

  const [card, leaderboard] = await Promise.all([publicTwin(twin), leaderboardRows(twin.id)]);
  return NextResponse.json({ twin: card, leaderboard });
}
