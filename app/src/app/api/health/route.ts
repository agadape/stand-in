import { count } from "drizzle-orm";
import { NextResponse } from "next/server";
import { formatEther } from "viem";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { funderStatus } from "@/lib/limits";
import { judgeLabel } from "@/lib/llm";
import { STYLOMETRY_VERSION } from "@/lib/stylometry";
import { treasury } from "@/lib/weather-pay";

/** Liveness for the team: judge, chain, contract, funder gas and database reachability. */
export async function GET() {
  const checks: Record<string, unknown> = { chainId: env().MONAD_CHAIN_ID, contract: env().STANDIN_ADDRESS };
  let ok = true;

  try {
    // The imitation game's judge; the pets' chat uses a model either way.
    checks.judge = env().JUDGE === "stylometry" ? STYLOMETRY_VERSION : judgeLabel();
  } catch (error) {
    checks.judge = { error: error instanceof Error ? error.message : String(error) };
    ok = false;
  }

  try {
    const funder = await funderStatus();
    checks.funder = { address: funder.address, balanceMon: Number(formatEther(funder.balance)).toFixed(4), ok: funder.ok };
    ok &&= funder.ok;
  } catch (error) {
    checks.funder = { error: error instanceof Error ? error.message : String(error) };
    ok = false;
  }

  try {
    // Where weather fees go. Without a treasury they return to the funder, which is circular.
    const to = treasury();
    checks.weather = { feeMon: env().WORLD_WEATHER_FEE_MON, treasury: to.address, treasuryIsFunder: to.isFunder };
  } catch (error) {
    checks.weather = { error: error instanceof Error ? error.message : String(error) };
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
