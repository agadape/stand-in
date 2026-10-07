import { randomBytes } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { keccak256, stringToHex, type Address, type Hex } from "viem";
import { registerTwin, readTwin } from "./contract";
import { db, schema } from "./db";
import type { Persona, Twin } from "./db/schema";
import { explorerAddress, explorerTx } from "./chain";

export function slugify(name: string) {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return `${base || "twin"}-${randomBytes(3).toString("hex")}`;
}

export function personaHash(persona: Persona) {
  return keccak256(stringToHex(JSON.stringify(persona)));
}

export async function createTwin(owner: Address, persona: Persona) {
  const slug = slugify(persona.name);
  const hash = personaHash(persona);
  const onchain = await registerTwin(slug, owner, hash);

  const twin = await db()
    .insert(schema.twins)
    .values({
      slug,
      name: persona.name,
      ownerAddress: owner,
      twinAddress: onchain.twinAddress,
      chainTwinId: onchain.chainTwinId,
      createTxHash: onchain.txHash,
      persona,
      personaHash: hash,
      createdAt: new Date(),
    })
    .returning()
    .get();

  return twin;
}

export async function twinBySlug(slug: string) {
  return db().select().from(schema.twins).where(eq(schema.twins.slug, slug)).get();
}

export async function leaderboard(twinId: number, limit = 20) {
  return db()
    .select()
    .from(schema.attempts)
    .where(eq(schema.attempts.twinId, twinId))
    .orderBy(desc(schema.attempts.scoreBps), desc(schema.attempts.createdAt))
    .limit(limit)
    .all();
}

/** The leaderboard as the client sees it: no answers, no persona, just the scoreboard. */
export async function leaderboardRows(twinId: number, limit = 20) {
  const rows = await leaderboard(twinId, limit);
  return rows.map((a) => ({
    id: a.id,
    mode: a.mode,
    displayName: a.displayName,
    address: a.address,
    scoreBps: a.scoreBps,
    passed: a.passed,
    verdictLine: a.llm.verdictLine,
    paidWei: a.paidWei,
    txUrl: explorerTx(a.txHash as Hex),
    createdAt: a.createdAt.getTime(),
  }));
}

/** What the client is allowed to see: never the persona samples. */
export async function publicTwin(twin: Twin) {
  const chain = await readTwin(twin.chainTwinId);
  return {
    slug: twin.slug,
    name: twin.name,
    bio: twin.persona.bio,
    ownerAddress: twin.ownerAddress,
    twinAddress: twin.twinAddress,
    twinExplorerUrl: explorerAddress(twin.twinAddress as Address),
    chainTwinId: twin.chainTwinId,
    ownerProven: chain.ownerProven,
    ownerScoreBps: chain.ownerScore,
    bestScoreBps: chain.bestScore,
    bestChallenger: chain.bestChallenger,
    attempts: chain.attempts,
    potWei: chain.pot.toString(),
    createdAt: twin.createdAt.getTime(),
  };
}

export type PublicTwin = Awaited<ReturnType<typeof publicTwin>>;
