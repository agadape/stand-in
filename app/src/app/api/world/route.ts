import { NextResponse } from "next/server";
import { advance, snapshot } from "@/lib/world";

// A tick can include one model call (a few seconds at most).
export const maxDuration = 30;
export const dynamic = "force-dynamic";

/**
 * The world, for anyone. Asking for it is also what moves it: if a tick is due and no
 * other request has claimed it, this one runs it first.
 */
export async function GET() {
  try {
    await advance();
  } catch (error) {
    // A failed tick must not blank the page; the next request tries again.
    console.error("[world] tick failed", error);
  }
  return NextResponse.json(await snapshot(), { headers: { "cache-control": "no-store" } });
}
