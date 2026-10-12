import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Wardrobe } from "@/components/wardrobe";
import { bondsOf } from "@/lib/bonds";
import { twinBySlug } from "@/lib/twins";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const twin = await twinBySlug((await params).slug);
  return { title: twin ? `${twin.name}'s wardrobe` : "Not found" };
}

export default async function WardrobePage({ params }: Props) {
  const twin = await twinBySlug((await params).slug);
  if (!twin) notFound();
  // Friends met: completed meetings only, each one a ProofOfMet transaction.
  const friends = (await bondsOf(twin)).filter((b) => b.done).length;
  return <Wardrobe twin={{ slug: twin.slug, name: twin.name, ownerAddress: twin.ownerAddress }} friends={friends} />;
}
