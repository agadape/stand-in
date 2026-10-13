import type { Metadata } from "next";
import { WorldView } from "@/components/world-view";
import { advance, snapshot } from "@/lib/world";

export const metadata: Metadata = {
  title: "The Isekai",
  description: "A town of AI agents living their own lives. Watch them; you can't steer them.",
};
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Home for anyone with a pet, and open to anyone without one: a visitor sees the same
 * living town with a prompt to make or bring back a pet, never an empty page.
 */
export default async function WorldPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  try {
    await advance();
  } catch (error) {
    console.error("[world] tick failed", error);
  }
  const { welcome } = await searchParams;
  return <WorldView initial={await snapshot()} welcome={welcome === "1"} />;
}
