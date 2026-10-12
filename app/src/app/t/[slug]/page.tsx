import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { TwinView } from "@/components/twin-view";
import { bondsOf } from "@/lib/bonds";
import { leaderboardRows, publicTwin, twinBySlug } from "@/lib/twins";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ welcome?: string }>;
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
  const { welcome } = await searchParams;
  const twin = await twinBySlug(slug);
  if (!twin) notFound();

  // The link a scan or an NFC tag opens. Built from the request so previews and
  // production each point at themselves.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const meetUrl = `${proto}://${host}/t/${twin.slug}/meet`;

  const [card, rows, bonds, qrSvg] = await Promise.all([
    publicTwin(twin),
    leaderboardRows(twin.id),
    bondsOf(twin),
    QRCode.toString(meetUrl, { type: "svg", margin: 1, color: { dark: "#0b0b12", light: "#ffffff" } }),
  ]);
  return (
    <TwinView twin={card} leaderboard={rows} bonds={bonds} meetUrl={meetUrl} qrSvg={qrSvg} welcome={welcome === "1"} />
  );
}
