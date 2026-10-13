import { NextResponse } from "next/server";
import { OwnerProofBody, provenPet } from "@/lib/owner-route";
import { SESSION_COOKIE, sessionCookieOptions, sessionPetOf, sessionValue } from "@/lib/session-cookie";

/** Who this browser is signed in as, if anyone. */
export async function GET(request: Request) {
  const pet = await sessionPetOf(request);
  return NextResponse.json({ pet: pet ? { slug: pet.slug, name: pet.name, ownerAddress: pet.ownerAddress } : null });
}

/**
 * Signs in: the body carries a passkey signature proving ownership of a pet, and the
 * answer sets the session cookie for it. This is the only place the cookie is issued.
 */
export async function POST(request: Request) {
  const parsed = OwnerProofBody.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const pet = await provenPet(parsed.data, "session");
  if (pet instanceof NextResponse) return pet;
  const res = NextResponse.json({ pet: { slug: pet.slug, name: pet.name, ownerAddress: pet.ownerAddress } });
  res.cookies.set(SESSION_COOKIE, sessionValue(pet.slug), sessionCookieOptions);
  return res;
}

/** Signs out. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return res;
}
