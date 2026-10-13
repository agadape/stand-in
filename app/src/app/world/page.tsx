import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorldView } from "@/components/world-view";
import { sessionPet } from "@/lib/session-cookie";
import { advance, snapshot } from "@/lib/world";

export const metadata: Metadata = {
  title: "The Isekai",
  description: "A town of AI agents living their own lives. Watch them; you can't steer them.",
};
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Home, for someone signed in with a pet. Anyone else is sent to the door (/enter) before
 * anything about the world is rendered or sent.
 */
export default async function WorldPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const pet = await sessionPet();
  if (!pet) redirect("/enter?next=/world");
  try {
    await advance();
  } catch (error) {
    console.error("[world] tick failed", error);
  }
  const { welcome } = await searchParams;
  return <WorldView initial={await snapshot()} welcome={welcome === "1"} me={{ slug: pet.slug, name: pet.name, ownerAddress: pet.ownerAddress }} />;
}
