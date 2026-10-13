import { NextResponse } from "next/server";
import { letterFor } from "@/lib/letter";
import { sessionPetOf } from "@/lib/session-cookie";

// One model call at most.
export const maxDuration = 30;
export const dynamic = "force-dynamic";

/**
 * A note from the signed-in pet about what happened to it since tick `since`. The pet is
 * taken from the session and from nowhere else, so nobody can ask for another pet's letter.
 */
export async function GET(request: Request) {
  const pet = await sessionPetOf(request);
  if (!pet) return NextResponse.json({ error: "Sign in with your pet's passkey to read its letter." }, { status: 401 });
  const raw = Number(new URL(request.url).searchParams.get("since"));
  const since = Number.isInteger(raw) && raw >= 0 ? raw : 0;
  const found = await letterFor(pet, since);
  return NextResponse.json({ letter: found?.letter ?? null, byModel: found?.byModel ?? false, since }, { headers: { "cache-control": "no-store" } });
}
