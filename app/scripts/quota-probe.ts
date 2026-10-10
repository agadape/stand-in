// What does the free tier say when a model refuses? Prints the full error, which names the limit.
//
//   cd app && npx tsx --env-file=.env.local scripts/quota-probe.ts [model,model,...]
//
// One tiny request per model (it counts against the quota when it succeeds).
import { GoogleGenAI } from "@google/genai";
import { env } from "../src/lib/env";

async function main() {
  const e = env();
  const models = (process.argv[2] ?? e.GEMINI_MODEL).split(",").map((m) => m.trim()).filter(Boolean);
  const client = new GoogleGenAI({ apiKey: e.GEMINI_API_KEY });
  for (const model of models) {
    try {
      await client.interactions.create(
        { model, input: "Reply with the single word: ok", generation_config: { thinking_level: e.GEMINI_THINKING } },
        { maxRetries: 0, timeout: 25_000 },
      );
      console.log(`${model}: ok (not limited right now)`);
    } catch (error) {
      const status = (error as { status?: number }).status ?? "error";
      console.log(`${model}: ${status} ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
