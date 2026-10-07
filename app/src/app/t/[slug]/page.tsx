import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TwinView } from "@/components/twin-view";
import { leaderboardRows, publicTwin, twinBySlug } from "@/lib/twins";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ welcome?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const twin = await twinBySlug(slug);
  if (!twin) return { title: "Not found" };
  const title = `Be ${twin.name}`;
  const description = `Answer three texts as ${twin.name}. Their AI twin decides if you pulled it off.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function TwinPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { welcome } = await searchParams;
  const twin = await twinBySlug(slug);
  if (!twin) notFound();

  const [card, rows] = await Promise.all([publicTwin(twin), leaderboardRows(twin.id)]);
  return <TwinView twin={card} leaderboard={rows} welcome={welcome === "1"} />;
}
