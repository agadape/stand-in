import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Meet } from "@/components/meet";
import { twinBySlug } from "@/lib/twins";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const twin = await twinBySlug(slug);
  return { title: twin ? `Meet ${twin.name}` : "Not found" };
}

/** Where a scanned code or a tapped tag lands. */
export default async function MeetPage({ params }: Props) {
  const { slug } = await params;
  const twin = await twinBySlug(slug);
  if (!twin) notFound();
  return <Meet twin={{ slug: twin.slug, name: twin.name, bio: twin.persona.bio }} />;
}
