// Do the models in the fallback chain judge alike?
//
//   cd app && npx tsx --env-file=.env.local scripts/judge-compare.ts [model,model,...] [reps] [voice,voice,...]
//
// e.g. `... scripts/judge-compare.ts gemini-3.7-flash 2 friend` to screen a candidate model
// on the one voice that separates a discriminating judge from a lenient one. Join models
// with "+" to test a fallback chain as one judge: `gemini-3.8-flash+gemini-3.7-flash`.
//
// Sends the same three answers, in three voices (owner / friend imitation / email
// impostor), to each model on its own and prints the model's 0-100 read plus the final
// score. The style half of the score is deterministic, so any spread between models is
// the model. A bar set by one model and a challenge judged by another is only fair if
// these rows agree; trim GEMINI_MODEL to the ones that do.
//
// No transactions and no database: it calls judge() directly. Costs models x 3 x reps
// judge calls (free tier is a handful per minute, so it paces itself).
import { answersFor, davePersona } from "../../scripts/fixtures.mjs";
import type { Persona } from "../src/lib/db/schema";
import { env } from "../src/lib/env";
import { judge } from "../src/lib/judge";
import { JudgeUnavailableError } from "../src/lib/llm";
import { scenarioById, type Scenario } from "../src/lib/scenarios";

const models = (process.argv[2] ?? env().GEMINI_MODEL).split(",").map((m) => m.trim()).filter(Boolean);
const reps = Number(process.argv[3] ?? 2);
const PAUSE_MS = 5_000;

// Fixed on purpose: every model sees exactly the same inputs.
const scenarios = ["late", "pineapple", "boss-sunday"].map((id) => scenarioById(id)) as Scenario[];
const { ownerAddress: _unused, ...rest } = davePersona("0x0");
void _unused;
const persona: Persona = { version: 1, ...rest };
const ALL_VOICES = ["owner", "friend", "impostor"] as const;
type Voice = (typeof ALL_VOICES)[number];
const voices = (process.argv[4]?.split(",").map((v) => v.trim()) ?? [...ALL_VOICES]).filter((v): v is Voice =>
  (ALL_VOICES as readonly string[]).includes(v),
);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function once(model: string, voice: Voice) {
  process.env.LLM_PROVIDER = "gemini";
  // Normally a one-model chain, so no fallback can hide the answer; "a+b" tests a real chain.
  process.env.GEMINI_MODEL = model.replaceAll("+", ",");
  for (let attempt = 1; attempt <= 3; attempt++) {
    const started = Date.now();
    try {
      const verdict = await judge(persona, scenarios, answersFor(voice, scenarios));
      if (model.includes("+")) console.log(`  (answered by ${verdict.model})`);
      return { overall: verdict.llm.overall, score: verdict.scoreBps / 100, ms: Date.now() - started };
    } catch (error) {
      if (!(error instanceof JudgeUnavailableError) || attempt === 3) {
        return { error: error instanceof Error ? error.message.slice(0, 120) : String(error) };
      }
      await sleep(20_000);
    }
  }
  return { error: "unreachable" };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const fmt = (n: number) => (Number.isNaN(n) ? "  n/a" : n.toFixed(1).padStart(5));

// tsx compiles this file as CommonJS (the app has no "type": "module"), so no top-level await.
async function main() {
  console.log(`scenarios: ${scenarios.map((s) => s.id).join(", ")} | reps: ${reps} | thinking: ${env().GEMINI_THINKING}`);
  console.log(`${"model".padEnd(24)} ${"voice".padEnd(9)} model-read (each)        mean   final-score  avg-latency`);

  const summary: Record<string, Record<string, number>> = {};
  for (const model of models) {
    summary[model] = {};
    for (const voice of voices) {
      const runs = [];
      for (let i = 0; i < reps; i++) {
        runs.push(await once(model, voice));
        await sleep(PAUSE_MS);
      }
      const ok = runs.filter((r): r is { overall: number; score: number; ms: number } => "overall" in r);
      const failed = runs.length - ok.length;
      summary[model][voice] = mean(ok.map((r) => r.score));
      console.log(
        `${model.padEnd(24)} ${voice.padEnd(9)} ${ok.map((r) => String(r.overall).padStart(3)).join(" ").padEnd(24)} ${fmt(mean(ok.map((r) => r.overall)))}  ${fmt(summary[model][voice])}%      ${ok.length ? (mean(ok.map((r) => r.ms)) / 1000).toFixed(1) + "s" : "-"}${failed ? `   (${failed} failed: ${(runs.find((r) => "error" in r) as { error: string }).error})` : ""}`,
      );
    }
  }

  if (voices.length === ALL_VOICES.length) {
    console.log("\nfinal score by model (owner / friend / impostor) and the friend's gap to the bar:");
    for (const model of models) {
      const s = summary[model];
      console.log(`${model.padEnd(24)} ${fmt(s.owner)} / ${fmt(s.friend)} / ${fmt(s.impostor)}   gap ${fmt(s.owner - s.friend)}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
