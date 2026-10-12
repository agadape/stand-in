import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Activity } from "@/components/activity";
import { bondsOf } from "@/lib/bonds";
import { leaderboardRows, publicTwin, twinBySlug } from "@/lib/twins";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const twin = await twinBySlug((await params).slug);
  return { title: twin ? `${twin.name}'s activity` : "Not found" };
}

export default async function ActivityPage({ params }: Props) {
  const twin = await twinBySlug((await params).slug);
  if (!twin) notFound();
  const [card, rows, bonds] = await Promise.all([publicTwin(twin), leaderboardRows(twin.id), bondsOf(twin)]);
  return <Activity twin={card} bonds={bonds} leaderboard={rows} />;
}
