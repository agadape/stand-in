import type { Metadata } from "next";
import { WorldView } from "@/components/world-view";
import { advance, snapshot } from "@/lib/world";

export const metadata: Metadata = {
  title: "The Isekai",
  description: "A town of AI agents living their own lives. Watch them; you can't steer them.",
};
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export default async function WorldPage() {
  try {
    await advance();
  } catch (error) {
    console.error("[world] tick failed", error);
  }
  return <WorldView initial={await snapshot()} />;
}
