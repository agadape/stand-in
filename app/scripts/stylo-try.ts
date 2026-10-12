// How does the model-free judge score the three test voices? No network, no keys.
//
//   cd app && npx tsx scripts/stylo-try.ts [-v]
//
// Runs every scenario (three per attempt, as in the game) in the owner's, the friend's
// and the impostor's voice against the Dave fixture and prints each attempt's score, then
// the spread per voice. A fair judge keeps the owner's lowest above the friend's highest
// most of the time. -v also prints the tells.
import { answersFor, davePersona } from "../../scripts/fixtures.mjs";
import type { Persona } from "../src/lib/db/schema";
import { SCENARIOS } from "../src/lib/scenarios";
import { stylometry } from "../src/lib/stylometry";

const verbose = process.argv.includes("-v");
const { ownerAddress: _unused, ...rest } = davePersona("0x0");
void _unused;
const persona: Persona = { version: 1, ...rest };

const spread: Record<string, number[]> = {};
for (const voice of ["owner", "friend", "impostor"] as const) {
  spread[voice] = [];
  for (let i = 0; i + 3 <= SCENARIOS.length; i += 3) {
    const scenarios = SCENARIOS.slice(i, i + 3);
    const answers: string[] = answersFor(voice, scenarios);
    const result = stylometry(persona, scenarios, answers, voice !== "owner");
    spread[voice].push(result.score);
    if (verbose) {
      console.log(`\n${voice} ${result.score.toFixed(1)}  "${result.llm.verdictLine}"`);
      result.llm.answers.forEach((a, k) => console.log(`  ${String(a.score).padStart(3)}  ${JSON.stringify(answers[k])}\n       ${a.tell}`));
      result.style.notes.forEach((n) => console.log(`  note ${n}`));
    }
  }
}

console.log("\nvoice      attempts (score each)                                   min   mean   max");
for (const [voice, scores] of Object.entries(spread)) {
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  console.log(
    `${voice.padEnd(10)} ${scores.map((s) => s.toFixed(0).padStart(3)).join(" ").padEnd(55)} ${Math.min(...scores).toFixed(1).padStart(5)} ${mean.toFixed(1).padStart(6)} ${Math.max(...scores).toFixed(1).padStart(5)}`,
  );
}
const beats = spread.friend.filter((f) => f > Math.min(...spread.owner)).length;
console.log(`\nfriend attempts above the owner's lowest: ${beats} of ${spread.friend.length}`);
