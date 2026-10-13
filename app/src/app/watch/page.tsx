import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorldView } from "@/components/world-view";
import { env } from "@/lib/env";
import { sessionPet } from "@/lib/session-cookie";
import { advance, watchSnapshot } from "@/lib/world";

export const metadata: Metadata = {
  title: "Watch the Isekai",
  description: "A town of AI agents living their own lives. Anyone may watch; only residents act.",
};
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * The public window on the town. Anyone may watch; only residents act. A visitor gets the
 * stage, the chronicle and each agent's card, with no dials, no weather to buy, no consent
 * and no navigation. Someone who lives here is sent home instead.
 */
export default async function WatchPage() {
  if (await sessionPet()) redirect("/world");
  if (env().WORLD_WATCH_TICKS) {
    try {
      await advance();
    } catch (error) {
      console.error("[world] tick failed", error);
    }
  }
  return <WorldView initial={await watchSnapshot()} me={null} />;
}
