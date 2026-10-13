// How long does the town take to bring a pair to the threshold?
//
//   cd app
//   $env:DATABASE_URL="file:./sim.db"; $env:WORLD_TICK_MS="1"; node ../scripts/db-push.mjs
//   npx tsx --env-file=.env.local scripts/world-sim.ts [ticks] [pauseMs]
//
// Runs the real tick loop (real model calls) against a scratch database and prints, every
// ten ticks, the closest pairs. Use a scratch DATABASE_URL: it fills the world tables.
import { advance, snapshot, THRESHOLD } from "../src/lib/world";

const ticks = Number(process.argv[2] ?? 100);
const pauseMs = Number(process.argv[3] ?? 2500);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let firstCross: number | null = null;
  let byModel = 0;
  let talks = 0;
  const seen = new Set<number>();
  for (let i = 1; i <= ticks; i++) {
    await advance();
    const w = await snapshot();
    for (const e of w.events) {
      if (seen.has(e.id) || e.kind !== "talk") continue;
      seen.add(e.id);
      talks++;
      if (e.byModel) byModel++;
    }
    const top = [...w.pairs].sort((a, b) => b.score - a.score);
    if (firstCross === null && top[0]?.score >= THRESHOLD) firstCross = w.tick;
    if (i % 10 === 0 || i === ticks) {
      const name = (id: number) => w.agents.find((a) => a.id === id)?.name ?? "?";
      console.log(
        `tick ${String(w.tick).padStart(3)}  talks ${talks} (${byModel} by model)  top: ${top
          .slice(0, 4)
          .map((p) => `${name(p.aId)}+${name(p.bId)} ${p.score}/${p.encounters}`)
          .join(", ")}`,
      );
    }
    await sleep(pauseMs);
  }
  console.log(firstCross === null ? `\nno pair reached ${THRESHOLD} in ${ticks} ticks` : `\nfirst pair reached ${THRESHOLD} at tick ${firstCross}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
