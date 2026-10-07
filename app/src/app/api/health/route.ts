import { count } from "drizzle-orm";
import { NextResponse } from "next/server";
import { formatEther } from "viem";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { funderStatus } from "@/lib/limits";

/** Liveness for the team: chain, contract, funder gas and database reachability. */
export async function GET() {
  const checks: Record<string, unknown> = { chainId: env().MONAD_CHAIN_ID, contract: env().STANDIN_ADDRESS };
  let ok = true;

  try {
    const funder = await funderStatus();
    checks.funder = { address: funder.address, balanceMon: Number(formatEther(funder.balance)).toFixed(4), ok: funder.ok };
    ok &&= funder.ok;
  } catch (error) {
    checks.funder = { error: error instanceof Error ? error.message : String(error) };
    ok = false;
  }

  try {
    const twins = await db().select({ n: count() }).from(schema.twins).get();
    const attempts = await db().select({ n: count() }).from(schema.attempts).get();
    checks.db = { ok: true, twins: twins?.n ?? 0, attempts: attempts?.n ?? 0 };
  } catch (error) {
    checks.db = { ok: false, error: error instanceof Error ? error.message : String(error) };
    ok = false;
  }

  return NextResponse.json({ ok, ...checks }, { status: ok ? 200 : 503 });
}
