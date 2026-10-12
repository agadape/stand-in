import { and, eq, or } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { keccak256, parseGwei, stringToHex, type Address, type Hex } from "viem";
import { explorerTx, publicClient } from "./chain";
import { db, schema } from "./db";
import type { Bond, PetChat, Twin } from "./db/schema";
import { petChat } from "./petchat";
import { ensureGas, twinAccount, twinWallet, withSendRetry } from "./twin-wallet";

/** The pair in its stored order: lower twin id is "a". */
function ordered(x: Twin, y: Twin) {
  return x.id < y.id ? { a: x, b: y } : { a: y, b: x };
}

export async function bondBetween(x: Twin, y: Twin) {
  const { a, b } = ordered(x, y);
  return db()
    .select()
    .from(schema.bonds)
    .where(and(eq(schema.bonds.aTwinId, a.id), eq(schema.bonds.bTwinId, b.id)))
    .get();
}

/** What the chain commits to: who bonded and exactly what their pets said. */
export function bondHash(a: Twin, b: Twin, chat: PetChat): Hex {
  return keccak256(stringToHex(JSON.stringify({ a: a.twinAddress, b: b.twinAddress, chat })));
}

/** Pet A's wallet sends pet B's wallet a zero-value note carrying the bond's hash. */
async function recordOnChain(a: Twin, b: Twin, hash: Hex) {
  await ensureGas(twinAccount(a.slug).address);
  const txHash = await withSendRetry((attempt) =>
    twinWallet(a.slug).sendTransaction({
      to: b.twinAddress as Address,
      value: 0n,
      data: hash,
      maxPriorityFeePerGas: parseGwei(String(2 + attempt)),
    }),
  );
  await publicClient().waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

/**
 * `from`'s owner says yes to `to`. The first yes leaves the bond pending; the second
 * completes it: the pets chat and the bond goes on-chain.
 */
export async function acceptBond(from: Twin, to: Twin): Promise<Bond> {
  const { a, b } = ordered(from, to);
  const fromIsA = from.id === a.id;
  let bond = await bondBetween(from, to);

  if (!bond) {
    bond = await db()
      .insert(schema.bonds)
      .values({ aTwinId: a.id, bTwinId: b.id, aAccepted: fromIsA, bAccepted: !fromIsA, createdAt: new Date() })
      .returning()
      .get();
  } else if (!(fromIsA ? bond.aAccepted : bond.bAccepted)) {
    bond = await db()
      .update(schema.bonds)
      .set(fromIsA ? { aAccepted: true } : { bAccepted: true })
      .where(eq(schema.bonds.id, bond.id))
      .returning()
      .get();
  }

  if (!bond.aAccepted || !bond.bAccepted || bond.completedAt) return bond;

  const { chat, model } = await petChat(a.persona, b.persona);
  const hash = bondHash(a, b, chat);
  const txHash = await recordOnChain(a, b, hash);
  return db()
    .update(schema.bonds)
    .set({ chat, chatModel: model, bondHash: hash, txHash, completedAt: new Date() })
    .where(eq(schema.bonds.id, bond.id))
    .returning()
    .get();
}

/** A twin's friends and open requests, as its page shows them. Never any persona text. */
export async function bondsOf(twin: Twin) {
  const a = alias(schema.twins, "a");
  const b = alias(schema.twins, "b");
  const rows = await db()
    .select({ bond: schema.bonds, a, b })
    .from(schema.bonds)
    .innerJoin(a, eq(schema.bonds.aTwinId, a.id))
    .innerJoin(b, eq(schema.bonds.bTwinId, b.id))
    .where(or(eq(schema.bonds.aTwinId, twin.id), eq(schema.bonds.bTwinId, twin.id)))
    .all();

  return rows
    .map(({ bond, a, b }) => {
      const mineIsA = a.id === twin.id;
      const other = mineIsA ? b : a;
      return {
        id: bond.id,
        other: { slug: other.slug, name: other.name, bio: other.persona.bio },
        done: Boolean(bond.completedAt),
        // An open request waits on this twin's owner, or on the other one.
        waitingOnMe: !bond.completedAt && !(mineIsA ? bond.aAccepted : bond.bAccepted),
        chemistry: bond.chat?.chemistry ?? null,
        summary: bond.chat?.summary ?? null,
        at: (bond.completedAt ?? bond.createdAt).getTime(),
      };
    })
    .sort((x, y) => y.at - x.at);
}

export type BondRow = Awaited<ReturnType<typeof bondsOf>>[number];

/** One completed bond in full, for its page: both names, the chat, and the proof. */
export async function bondRecord(id: number) {
  const a = alias(schema.twins, "a");
  const b = alias(schema.twins, "b");
  const row = await db()
    .select({ bond: schema.bonds, a, b })
    .from(schema.bonds)
    .innerJoin(a, eq(schema.bonds.aTwinId, a.id))
    .innerJoin(b, eq(schema.bonds.bTwinId, b.id))
    .where(eq(schema.bonds.id, id))
    .get();
  if (!row || !row.bond.chat || !row.bond.txHash) return null;
  const side = (t: Twin) => ({ slug: t.slug, name: t.name, bio: t.persona.bio, twinAddress: t.twinAddress });
  return {
    id: row.bond.id,
    a: side(row.a),
    b: side(row.b),
    chat: row.bond.chat,
    bondHash: row.bond.bondHash,
    txUrl: explorerTx(row.bond.txHash as Hex),
    completedAt: row.bond.completedAt?.getTime() ?? 0,
  };
}

export type BondRecord = NonNullable<Awaited<ReturnType<typeof bondRecord>>>;
