import type { Metadata } from "next";
import { MeraPanel } from "@/components/mera-panel";
import { requireResident } from "@/lib/session-cookie";

export const metadata: Metadata = { title: "Passkey namespaces" };
export const dynamic = "force-dynamic";

/** How the signed-in pet uses its passkey beyond being an account. For residents, like the world. */
export default async function MeraPage() {
  const pet = await requireResident("/mera");
  return <MeraPanel pet={{ slug: pet.slug, name: pet.name, ownerAddress: pet.ownerAddress }} />;
}
