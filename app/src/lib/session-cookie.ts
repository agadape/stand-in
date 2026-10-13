import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Twin } from "./db/schema";
import { env } from "./env";
import { twinBySlug } from "./twins";

/**
 * The signed-in session: an httpOnly cookie that says "this browser proved, with its
 * passkey, that it owns this pet". It is issued only by POST /api/session after a valid
 * owner signature, and it is what lets someone into the world. The value is
 * `<slug>.<expiry>.<hmac>`, signed with the server secret, so it cannot be forged or
 * pointed at someone else's pet.
 */
export const SESSION_COOKIE = "standin_session";
const MAX_AGE_S = 30 * 24 * 60 * 60;

function sign(payload: string) {
  return createHmac("sha256", `session:${env().TWIN_KEY_SEED}`).update(payload).digest("hex");
}

export function sessionValue(slug: string) {
  const payload = `${slug}.${Math.floor(Date.now() / 1000) + MAX_AGE_S}`;
  return `${payload}.${sign(payload)}`;
}

/** The slug a cookie value vouches for, or null if it is forged, malformed or expired. */
export function slugFromSession(value: string | undefined): string | null {
  if (!value) return null;
  const cut = value.lastIndexOf(".");
  const payload = value.slice(0, cut);
  const mac = value.slice(cut + 1);
  const expected = sign(payload);
  if (mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  const dot = payload.lastIndexOf(".");
  const slug = payload.slice(0, dot);
  const expiry = Number(payload.slice(dot + 1));
  return slug && Number.isFinite(expiry) && expiry * 1000 > Date.now() ? slug : null;
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_S,
};

/** The pet this request is signed in as, if any. */
export async function sessionPet(): Promise<Twin | null> {
  const slug = slugFromSession((await cookies()).get(SESSION_COOKIE)?.value);
  return slug ? ((await twinBySlug(slug)) ?? null) : null;
}

/** Where the door may send someone once they are in. Anything else goes to the world. */
export function safeNext(next: string | undefined): string {
  return next && /^\/(world|rooms|wall|mera|r\/\d{1,9}|e\/\d{1,9})$/.test(next) ? next : "/world";
}

/**
 * For a page only residents may see: the signed-in pet, or a trip to the door that
 * remembers where they were going. Nothing about the page is rendered for a visitor.
 */
export async function requireResident(path: string): Promise<Twin> {
  const pet = await sessionPet();
  if (!pet) redirect(`/enter?next=${encodeURIComponent(path)}`);
  return pet;
}

/** The same check for a route handler, from its request's Cookie header. */
export async function sessionPetOf(request: Request): Promise<Twin | null> {
  const raw = request.headers.get("cookie") ?? "";
  const value = raw
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  const slug = slugFromSession(value ? decodeURIComponent(value) : undefined);
  return slug ? ((await twinBySlug(slug)) ?? null) : null;
}
