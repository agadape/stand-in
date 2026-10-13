import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { OwnerProofBody, provenPet } from "@/lib/owner-route";
import { twinBySlug } from "@/lib/twins";

const Tier = z.enum(["private", "sensitive"]);
const b64url = z.string().regex(/^[A-Za-z0-9_-]+$/);

// The shape of a Mera secret vault. Everything in it is safe to store: it is ciphertext
// plus what the passkey needs to find the key again.
const Vault = z.object({
  version: z.literal(1),
  credential: z.object({ credentialId: b64url.max(1400) }).passthrough(),
  prfSalt: b64url.max(64),
  nonce: b64url.max(32),
  ciphertext: b64url.max(12_000),
});

/** The ciphertext of each tier this pet has locked. Useless without the owner's passkey. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const twin = await twinBySlug((await params).slug);
  if (!twin) return NextResponse.json({ error: "No such pet" }, { status: 404 });
  const rows = await db().select().from(schema.soulVaults).where(eq(schema.soulVaults.twinId, twin.id)).all();
  return NextResponse.json({
    vaults: rows.map((r) => ({ tier: r.tier, vault: JSON.parse(r.vault) as unknown, updatedAt: r.updatedAt.getTime() })),
  });
}

/** Stores one tier's ciphertext. The plaintext never reaches this server. */
export async function PUT(request: Request) {
  const parsed = OwnerProofBody.extend({ tier: Tier, vault: Vault }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { tier, vault } = parsed.data;
  const pet = await provenPet(parsed.data, `vault:save:${tier}`);
  if (pet instanceof NextResponse) return pet;

  const text = JSON.stringify(vault);
  const existing = await db()
    .select({ id: schema.soulVaults.id })
    .from(schema.soulVaults)
    .where(and(eq(schema.soulVaults.twinId, pet.id), eq(schema.soulVaults.tier, tier)))
    .get();
  if (existing) await db().update(schema.soulVaults).set({ vault: text, updatedAt: new Date() }).where(eq(schema.soulVaults.id, existing.id));
  else await db().insert(schema.soulVaults).values({ twinId: pet.id, tier, vault: text, updatedAt: new Date() });
  return NextResponse.json({ ok: true, tier });
}
