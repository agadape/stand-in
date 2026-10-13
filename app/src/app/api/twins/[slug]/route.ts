import { NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE, sessionCookieOptions, sessionPetOf } from "@/lib/session-cookie";
import { deleteTwin, leaderboardRows, publicTwin, twinBySlug } from "@/lib/twins";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const twin = await twinBySlug(slug);
  if (!twin) return NextResponse.json({ error: "No such twin" }, { status: 404 });

  const [card, leaderboard] = await Promise.all([publicTwin(twin), leaderboardRows(twin.id)]);
  return NextResponse.json({ twin: card, leaderboard });
}

/**
 * Deletes a pet. The session is the proof: the browser signed in as this pet with its
 * passkey, and nobody else holds that cookie. A fresh passkey prompt is deliberately not
 * asked for, because the owner this is for is the one whose passkey has stopped working
 * on their device. The pet's name has to be typed, so it cannot happen by a stray tap.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const me = await sessionPetOf(request);
  if (!me) return NextResponse.json({ error: "Sign in as this pet to delete it." }, { status: 401 });
  if (me.slug !== slug) return NextResponse.json({ error: "You can only delete the pet you are signed in as." }, { status: 403 });
  const parsed = z.object({ confirm: z.string() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.confirm.trim().toLowerCase() !== me.name.trim().toLowerCase()) {
    return NextResponse.json({ error: `Type ${me.name} to confirm.` }, { status: 400 });
  }
  await deleteTwin(me);
  const res = NextResponse.json({ deleted: slug });
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return res;
}
