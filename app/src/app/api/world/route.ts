import { NextResponse } from "next/server";
import { sessionPetOf } from "@/lib/session-cookie";
import { advance, snapshot } from "@/lib/world";

// A tick can include one model call (a few seconds at most).
export const maxDuration = 30;
export const dynamic = "force-dynamic";

/**
 * The world, for someone signed in with a pet. Nobody else gets it. Asking for it is also
 * what moves it: if a tick is due and no other request has claimed it, this one runs it.
 */
export async function GET(request: Request) {
  if (!(await sessionPetOf(request))) {
    return NextResponse.json({ error: "Sign in with your pet's passkey to enter the world." }, { status: 401 });
  }
  try {
    await advance();
  } catch (error) {
    // A failed tick must not blank the page; the next request tries again.
    console.error("[world] tick failed", error);
  }
  return NextResponse.json(await snapshot(), { headers: { "cache-control": "no-store" } });
}
