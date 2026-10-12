import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Meet, type Scanned } from "@/components/meet";
import { twinBySlug } from "@/lib/twins";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ c?: string; g?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const twin = await twinBySlug(slug);
  return { title: twin ? `Meet ${twin.name}` : "Not found" };
}

/** `c` is "<seconds>.<8-byte nonce>.<65-byte signature>", hex without 0x, as ShowCode writes it. */
function parseCode(c: string | undefined, g: string | undefined): Scanned | null {
  const m = c?.match(/^(\d{9,11})\.([0-9a-fA-F]{16})\.([0-9a-fA-F]{130})$/);
  if (!m) return null;
  const gatheringId = /^\d{1,9}$/.test(g ?? "") ? Number(g) : 0;
  return { code: { issuedAt: Number(m[1]), nonce: `0x${m[2]}`, signature: `0x${m[3]}` }, gatheringId };
}

/** Where a scanned code or a tapped tag lands. */
export default async function MeetPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { c, g } = await searchParams;
  const twin = await twinBySlug(slug);
  if (!twin) notFound();
  return <Meet twin={{ slug: twin.slug, name: twin.name, bio: twin.persona.bio }} scanned={parseCode(c, g)} />;
}
