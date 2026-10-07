import { createHash } from "node:crypto";
import { and, count, eq, gt, sql, type SQL } from "drizzle-orm";
import { NextResponse } from "next/server";
import { formatEther, parseEther } from "viem";
import { publicClient } from "./chain";
import { db, schema } from "./db";
import { env } from "./env";
import { funderWallet } from "./twin-wallet";

/**
 * Every twin and every attempt costs the funder gas and (for attempts) a judge call,
 * so a public URL needs ceilings. Counts come from the database, which makes them
 * hold across serverless instances. IPs are stored only as salted hashes.
 */
export class LimitError extends Error {
  constructor(
    message: string,
    public readonly status: 429 | 503 = 429,
  ) {
    super(message);
  }
}

export function limitResponse(error: unknown) {
  if (error instanceof LimitError) return NextResponse.json({ error: error.message }, { status: error.status });
  return null;
}

export function clientIpHash(request: Request): string | null {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim();
  if (!ip) return null;
  return createHash("sha256").update(`${env().TWIN_KEY_SEED}:${ip}`).digest("hex").slice(0, 32);
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

async function twinsSince(windowMs: number, ...conditions: SQL[]) {
  const row = await db()
    .select({ n: count() })
    .from(schema.twins)
    .where(and(gt(schema.twins.createdAt, new Date(Date.now() - windowMs)), ...conditions))
    .get();
  return row?.n ?? 0;
}

async function attemptsSince(windowMs: number, ...conditions: SQL[]) {
  const row = await db()
    .select({ n: count() })
    .from(schema.attempts)
    .where(and(gt(schema.attempts.createdAt, new Date(Date.now() - windowMs)), ...conditions))
    .get();
  return row?.n ?? 0;
}

export async function assertCanCreateTwin(ownerAddress: string, ipHash: string | null) {
  const e = env();
  if ((await twinsSince(DAY)) >= e.LIMIT_TWINS_PER_DAY) {
    throw new LimitError("Stand-In has hit today's limit on new twins. Try again tomorrow.", 503);
  }
  if ((await twinsSince(DAY, sql`lower(${schema.twins.ownerAddress}) = ${ownerAddress.toLowerCase()}`)) >= e.LIMIT_TWINS_PER_OWNER_DAY) {
    throw new LimitError(`One passkey can make ${e.LIMIT_TWINS_PER_OWNER_DAY} twins a day. Come back tomorrow.`);
  }
  if (ipHash && (await twinsSince(DAY, eq(schema.twins.ipHash, ipHash))) >= e.LIMIT_TWINS_PER_IP_DAY) {
    throw new LimitError("Too many twins from this network today. Try again tomorrow.");
  }
  await assertFunderHasGas();
}

export async function assertCanAttempt(twinId: number, address: string, ipHash: string | null) {
  const e = env();
  if ((await attemptsSince(DAY)) >= e.LIMIT_ATTEMPTS_PER_DAY) {
    throw new LimitError("Stand-In has hit today's limit on attempts. Try again tomorrow.", 503);
  }
  if ((await attemptsSince(HOUR, eq(schema.attempts.twinId, twinId))) >= e.LIMIT_ATTEMPTS_PER_TWIN_HOUR) {
    throw new LimitError("This twin is taking a breather: too many attempts in the last hour. Try again soon.");
  }
  if ((await attemptsSince(HOUR, sql`lower(${schema.attempts.address}) = ${address.toLowerCase()}`)) >= e.LIMIT_ATTEMPTS_PER_ADDRESS_HOUR) {
    throw new LimitError(`You've had ${e.LIMIT_ATTEMPTS_PER_ADDRESS_HOUR} goes this hour. Let someone else be them for a bit.`);
  }
  if (ipHash && (await attemptsSince(HOUR, eq(schema.attempts.ipHash, ipHash))) >= e.LIMIT_ATTEMPTS_PER_IP_HOUR) {
    throw new LimitError("Too many attempts from this network. Try again in a while.");
  }
  await assertFunderHasGas();
}

export async function funderStatus() {
  const address = funderWallet().account.address;
  const balance = await publicClient().getBalance({ address });
  return { address, balance, ok: balance >= parseEther(String(env().MIN_FUNDER_MON)) };
}

async function assertFunderHasGas() {
  const status = await funderStatus();
  if (!status.ok) {
    throw new LimitError(
      `The house is out of gas (${Number(formatEther(status.balance)).toFixed(3)} MON left). Someone needs to top up the funder wallet.`,
      503,
    );
  }
}
