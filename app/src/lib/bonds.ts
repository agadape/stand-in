import { and, eq, or } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { keccak256, stringToHex, type Hex } from "viem";
import { explorerTx } from "./chain";
import { db, schema } from "./db";
import type { Bond, PetChat, Twin } from "./db/schema";
import { burnCode, checkCode, recordMeet, type Code } from "./met";
import { petChat } from "./petchat";

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

/**
 * `from`'s owner says yes to `to`.
 *
 * With a fresh code scanned off `to`'s screen, that one yes is enough: showing a code
 * only your passkey can unlock is `to`'s yes, and the friendship is recorded as met in
 * person. Without one (the static link, an NFC sticker) the first yes leaves the bond
 * pending and the second completes it, recorded as a link.
 *
 * Completing means: the pets chat, and the scanner's pet writes the meeting to
 * ProofOfMet carrying the other pet's signature.
 */
export async function acceptBond(from: Twin, to: Twin, scanned?: { code: Code; gatheringId: number }): Promise<Bond> {
  const { a, b } = ordered(from, to);
  const fromIsA = from.id === a.id;
  let bond = await bondBetween(from, to);
  if (bond?.completedAt) return bond;
  if (scanned) await checkCode(to, scanned.gatheringId, scanned.code);

  const accepted = scanned ? { aAccepted: true, bAccepted: true } : fromIsA ? { aAccepted: true } : { bAccepted: true };
  if (!bond) {
    bond = await db()
      .insert(schema.bonds)
      .values({ aTwinId: a.id, bTwinId: b.id, aAccepted: false, bAccepted: false, ...accepted, createdAt: new Date() })
      .returning()
      .get();
  } else {
    bond = await db().update(schema.bonds).set(accepted).where(eq(schema.bonds.id, bond.id)).returning().get();
  }

  if (!bond.aAccepted || !bond.bAccepted) return bond;

  const { chat, model } = await petChat(a.persona, b.persona);
  const hash = bondHash(a, b, chat);
  if (scanned) await burnCode(to, scanned.code);
  const method = scanned ? "code" : "link";
  const gatheringId = scanned?.gatheringId ?? 0;
  const txHash = await recordMeet({ shown: to, scanner: from, method, gatheringId, code: scanned?.code, chatHash: hash });
  return db()
    .update(schema.bonds)
    .set({ chat, chatModel: model, bondHash: hash, txHash, method, gatheringId, completedAt: new Date() })
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
        inPerson: bond.method === "code",
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
    inPerson: row.bond.method === "code",
    gatheringId: row.bond.gatheringId ?? 0,
    txUrl: explorerTx(row.bond.txHash as Hex),
    completedAt: row.bond.completedAt?.getTime() ?? 0,
  };
}

export type BondRecord = NonNullable<Awaited<ReturnType<typeof bondRecord>>>;
