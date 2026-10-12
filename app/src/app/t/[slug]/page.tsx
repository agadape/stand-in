import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { TwinView } from "@/components/twin-view";
import { bondsOf } from "@/lib/bonds";
import { leaderboardRows, publicTwin, twinBySlug } from "@/lib/twins";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ welcome?: string; g?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const twin = await twinBySlug(slug);
  if (!twin) return { title: "Not found" };
  const title = `${twin.name}'s pet`;
  const description = `Meet ${twin.name}'s AI pet on Stand-In: scan to become friends, or try to text like ${twin.name}.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function TwinPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { welcome, g } = await searchParams;
  const twin = await twinBySlug(slug);
  if (!twin) notFound();

  // The link a scan or an NFC tag opens. Built from the request so previews and
  // production each point at themselves.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const meetUrl = `${proto}://${host}/t/${twin.slug}/meet`;

  const [card, rows, bonds] = await Promise.all([publicTwin(twin), leaderboardRows(twin.id), bondsOf(twin)]);
  const gatheringId = /^\d{1,9}$/.test(g ?? "") ? Number(g) : 0;
  return (
    <TwinView
      twin={card}
      leaderboard={rows}
      bonds={bonds}
      meetUrl={meetUrl}
      gatheringId={gatheringId}
      welcome={welcome === "1"}
    />
  );
}
