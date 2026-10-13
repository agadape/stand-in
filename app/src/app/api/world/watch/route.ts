import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { advance, watchSnapshot } from "@/lib/world";

// A tick can include one model call (a few seconds at most).
export const maxDuration = 30;
export const dynamic = "force-dynamic";

/**
 * The town for anyone, signed in or not: something to look at and nothing to act with.
 * It leaves out who owns which pet and whether one human has said yes to an introduction.
 * Only GET exists; there is nothing here to post to.
 *
 * Watching moves the town, as a resident's page does, unless WORLD_WATCH_TICKS is 0. Then
 * this only shows the town as residents left it.
 */
export async function GET() {
  if (env().WORLD_WATCH_TICKS) {
    try {
      await advance();
    } catch (error) {
      // A failed tick must not blank the page; the next request tries again.
      console.error("[world] tick failed", error);
    }
  }
  return NextResponse.json(await watchSnapshot(), { headers: { "cache-control": "no-store" } });
}
