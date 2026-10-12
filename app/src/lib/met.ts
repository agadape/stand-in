import { randomBytes } from "node:crypto";
import { inArray } from "drizzle-orm";
import {
  encodeAbiParameters,
  keccak256,
  pad,
  parseEventLogs,
  parseGwei,
  recoverMessageAddress,
  type Address,
  type Hex,
} from "viem";
import { metAddress, publicClient } from "./chain";
import { db, schema } from "./db";
import type { Twin } from "./db/schema";
import { env } from "./env";
import { metAbi } from "./met-abi";
import { ensureGas, twinAccount, twinWallet, withSendRetry } from "./twin-wallet";

/**
 * ProofOfMet from the server's side: issuing the rotating codes a pet shows, checking a
 * scanned one, and sending the pet wallets' transactions. Numbers here mirror the contract.
 */

/** How long each code stays on screen. */
export const CODE_SHOWN_MS = 20_000;
/** After leaving the screen a code still works this long, to cover the scan and the tap. */
export const CODE_GRACE_MS = 45_000;
/** One Face ID buys this many codes: ten minutes of holding your phone out. */
const CODES_PER_BATCH = 30;

export type Code = { issuedAt: number; nonce: Hex; signature: Hex };

const METHOD = { link: 0, code: 1 } as const;
export type Method = keyof typeof METHOD;

const tip = (attempt: number) => ({ maxPriorityFeePerGas: parseGwei(String(2 + attempt)) });

/**
 * Monad charges for the gas limit, not for the gas used, so every unit of headroom is paid
 * for. This asks the node what the call needs and adds a tenth, for state that shifts
 * between the estimate and the block (someone else meeting the same pet a moment earlier
 * makes a storage write cheaper or dearer). `fallback` is used if the node will not estimate.
 */
async function gasFor(from: Address, functionName: string, args: readonly unknown[], fallback: bigint) {
  try {
    const estimate = await publicClient().estimateContractGas({
      address: metAddress(),
      abi: metAbi,
      functionName,
      args,
      account: from,
    } as Parameters<ReturnType<typeof publicClient>["estimateContractGas"]>[0]);
    return (estimate * 110n) / 100n;
  } catch {
    return fallback;
  }
}

/** Same bytes as ProofOfMet.codeDigest. `issuedAt` is in seconds, as the chain counts. */
function codeDigest(pet: Address, gatheringId: number, issuedAtSec: number, nonce: Hex) {
  return keccak256(
    encodeAbiParameters(
      [{ type: "string" }, { type: "address" }, { type: "uint256" }, { type: "address" }, { type: "uint64" }, { type: "uint64" }, { type: "bytes32" }],
      ["StandIn code", metAddress(), BigInt(env().MONAD_CHAIN_ID), pet, BigInt(gatheringId), BigInt(issuedAtSec), pad(nonce)],
    ),
  );
}

/** Same bytes as ProofOfMet.linkDigest. */
function linkDigest(a: Address, b: Address) {
  return keccak256(
    encodeAbiParameters(
      [{ type: "string" }, { type: "address" }, { type: "uint256" }, { type: "address" }, { type: "address" }],
      ["StandIn link", metAddress(), BigInt(env().MONAD_CHAIN_ID), a, b],
    ),
  );
}

/**
 * The next ten minutes of codes for a pet, each signed by the pet's wallet and good for
 * one use. Each carries the moment it goes on screen, so one request (one Face ID) covers
 * the whole batch and a code read off a screenshot is stale within about a minute.
 */
export async function issueCodes(twin: Twin, gatheringId: number): Promise<Code[]> {
  const account = twinAccount(twin.slug);
  const first = Math.floor(Date.now() / 1000);
  return Promise.all(
    Array.from({ length: CODES_PER_BATCH }, async (_, i) => {
      const issuedAt = first + (i * CODE_SHOWN_MS) / 1000;
      const nonce = `0x${randomBytes(8).toString("hex")}` as Hex;
      const signature = await account.signMessage({ message: { raw: codeDigest(account.address, gatheringId, issuedAt, nonce) } });
      return { issuedAt, nonce, signature };
    }),
  );
}

export class CodeError extends Error {}

/**
 * Is this scanned code signed by this pet and currently (or just) on screen? Throws
 * CodeError with something the scanner can act on. Does not spend it; see burnCode.
 */
export async function checkCode(shownBy: Twin, gatheringId: number, code: Code) {
  const now = Date.now();
  const shownAt = code.issuedAt * 1000;
  // A few seconds of slack for phones whose clocks run ahead.
  if (now < shownAt - 5_000 || now > shownAt + CODE_SHOWN_MS + CODE_GRACE_MS) {
    throw new CodeError(`That code has expired. Ask ${shownBy.name} to show their code again and scan the new one.`);
  }
  const signer = await recoverMessageAddress({
    message: { raw: codeDigest(shownBy.twinAddress as Address, gatheringId, code.issuedAt, code.nonce) },
    signature: code.signature,
  }).catch(() => null);
  if (signer?.toLowerCase() !== shownBy.twinAddress.toLowerCase()) {
    throw new CodeError(`That isn't one of ${shownBy.name}'s codes.`);
  }
}

/** Spends a checked code. A code works once; the contract enforces the same on-chain. */
export async function burnCode(shownBy: Twin, code: Code) {
  try {
    await db().insert(schema.usedCodes).values({ nonce: `${shownBy.id}:${code.nonce}`, twinId: shownBy.id, usedAt: new Date() });
  } catch {
    throw new CodeError(`That code was already used. Ask ${shownBy.name} to show a new one.`);
  }
}

/**
 * Writes the meeting to ProofOfMet. `shown` is the pet whose code was scanned (or, for a
 * link, the one approving); `scanner`'s wallet sends the transaction carrying `shown`'s
 * signature, so the record needs both pets.
 */
export async function recordMeet(params: {
  shown: Twin;
  scanner: Twin;
  method: Method;
  gatheringId: number;
  code?: Code;
  chatHash: Hex;
}) {
  const { shown, scanner, method, gatheringId, code, chatHash } = params;
  const a = shown.twinAddress as Address;
  const b = scanner.twinAddress as Address;
  const signature =
    method === "code" && code
      ? code.signature
      : await twinAccount(shown.slug).signMessage({ message: { raw: linkDigest(a, b) } });

  const args = [
    a,
    METHOD[method],
    BigInt(method === "code" ? gatheringId : 0),
    BigInt(code?.issuedAt ?? 0),
    pad(code?.nonce ?? "0x"),
    chatHash,
    signature,
  ] as const;

  await ensureGas(b);
  const hash = await withSendRetry(async (attempt) =>
    twinWallet(scanner.slug).writeContract({
      address: metAddress(),
      abi: metAbi,
      functionName: "recordMeet",
      args,
      gas: await gasFor(b, "recordMeet", args, 450_000n),
      ...tip(attempt),
    }),
  );
  const receipt = await publicClient().waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("The meeting transaction reverted");
  return hash;
}

// ------------------------------------------------------------------- gatherings

export type Gathering = {
  id: number;
  host: Address;
  name: string;
  startsAt: number;
  endsAt: number;
  meets: number;
  attendees: number;
  /** Still running at the moment it was read. */
  open: boolean;
};

export async function createGathering(host: Twin, name: string, hours: number) {
  await ensureGas(host.twinAddress as Address);
  const startsAt = BigInt(Math.floor(Date.now() / 1000) - 60);
  const endsAt = startsAt + BigInt(Math.round(hours * 3600));
  const hash = await withSendRetry(async (attempt) =>
    twinWallet(host.slug).writeContract({
      address: metAddress(),
      abi: metAbi,
      functionName: "createGathering",
      args: [name, startsAt, endsAt],
      gas: await gasFor(host.twinAddress as Address, "createGathering", [name, startsAt, endsAt], 250_000n),
      ...tip(attempt),
    }),
  );
  const receipt = await publicClient().waitForTransactionReceipt({ hash });
  const [created] = parseEventLogs({ abi: metAbi, logs: receipt.logs, eventName: "GatheringCreated" });
  if (!created) throw new Error("GatheringCreated event missing from receipt");
  return { id: Number(created.args.gatheringId), txHash: hash };
}

export async function getGathering(id: number): Promise<Gathering | null> {
  try {
    const g = await publicClient().readContract({ address: metAddress(), abi: metAbi, functionName: "getGathering", args: [BigInt(id)] });
    const now = Date.now() / 1000;
    return {
      id,
      host: g.host,
      name: g.name,
      startsAt: Number(g.startsAt),
      endsAt: Number(g.endsAt),
      meets: g.meets,
      attendees: g.attendees,
      open: now >= Number(g.startsAt) && now <= Number(g.endsAt),
    };
  } catch {
    return null;
  }
}

export async function listGatherings(): Promise<Gathering[]> {
  const count = Number(await publicClient().readContract({ address: metAddress(), abi: metAbi, functionName: "gatheringCount" }));
  const ids = Array.from({ length: Math.min(count, 20) }, (_, i) => count - i);
  return (await Promise.all(ids.map(getGathering))).filter((g): g is Gathering => g !== null);
}

// ------------------------------------------------------------------------ rooms

export type Room = { id: number; creator: Address; name: string; threshold: number; inPersonOnly: boolean; members: Address[] };

export async function createRoom(creator: Twin, name: string, threshold: number, inPersonOnly: boolean) {
  await ensureGas(creator.twinAddress as Address);
  const hash = await withSendRetry(async (attempt) =>
    twinWallet(creator.slug).writeContract({
      address: metAddress(),
      abi: metAbi,
      functionName: "createRoom",
      args: [name, threshold, inPersonOnly],
      gas: await gasFor(creator.twinAddress as Address, "createRoom", [name, threshold, inPersonOnly], 300_000n),
      ...tip(attempt),
    }),
  );
  const receipt = await publicClient().waitForTransactionReceipt({ hash });
  const [created] = parseEventLogs({ abi: metAbi, logs: receipt.logs, eventName: "RoomCreated" });
  if (!created) throw new Error("RoomCreated event missing from receipt");
  return { id: Number(created.args.roomId), txHash: hash };
}

export async function getRoom(id: number): Promise<Room | null> {
  try {
    const [creator, name, threshold, inPersonOnly, members] = await publicClient().readContract({
      address: metAddress(),
      abi: metAbi,
      functionName: "getRoom",
      args: [BigInt(id)],
    });
    return { id, creator, name, threshold, inPersonOnly, members: [...members] };
  } catch {
    return null;
  }
}

export async function listRooms(): Promise<Room[]> {
  const count = Number(await publicClient().readContract({ address: metAddress(), abi: metAbi, functionName: "roomCount" }));
  const ids = Array.from({ length: Math.min(count, 30) }, (_, i) => count - i);
  return (await Promise.all(ids.map(getRoom))).filter((r): r is Room => r !== null);
}

/** Straight from the contract: may this pet join, how many members vouch, how many it needs. */
export async function canJoin(roomId: number, pet: Address) {
  const [ok, vouches, needed] = await publicClient().readContract({
    address: metAddress(),
    abi: metAbi,
    functionName: "canJoin",
    args: [BigInt(roomId), pet],
  });
  const member = await publicClient().readContract({ address: metAddress(), abi: metAbi, functionName: "isMember", args: [BigInt(roomId), pet] });
  return { ok, member, vouches: Number(vouches), needed: Number(needed) };
}

export async function joinRoom(pet: Twin, roomId: number) {
  await ensureGas(pet.twinAddress as Address);
  const hash = await withSendRetry(async (attempt) =>
    twinWallet(pet.slug).writeContract({
      address: metAddress(),
      abi: metAbi,
      functionName: "join",
      args: [BigInt(roomId)],
      gas: await gasFor(pet.twinAddress as Address, "join", [BigInt(roomId)], 200_000n),
      ...tip(attempt),
    }),
  );
  const receipt = await publicClient().waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("The room refused: not enough members have met this pet");
  return hash;
}

// ------------------------------------------------------------------------- wall

/** Every meeting on the contract (or one gathering's), oldest first. Read directly, no indexer. */
export async function meetings(gatheringId = 0) {
  const all = await publicClient().readContract({ address: metAddress(), abi: metAbi, functionName: "meetsFrom", args: [0n, 500n] });
  return all
    .filter((m) => gatheringId === 0 || Number(m.gatheringId) === gatheringId)
    .map((m) => ({ a: m.a, b: m.b, at: Number(m.at), inPerson: m.method === METHOD.code, gatheringId: Number(m.gatheringId) }));
}

/** Pet names for a set of wallet addresses; addresses we don't know are left out. */
export async function petsByAddress(addresses: readonly string[]) {
  if (addresses.length === 0) return new Map<string, { slug: string; name: string }>();
  // Stored checksummed, as viem returns them, so an exact match works.
  const rows = await db()
    .select({ slug: schema.twins.slug, name: schema.twins.name, twinAddress: schema.twins.twinAddress })
    .from(schema.twins)
    .where(inArray(schema.twins.twinAddress, [...new Set(addresses)]))
    .all();
  return new Map(rows.map((r) => [r.twinAddress.toLowerCase(), { slug: r.slug, name: r.name }]));
}
