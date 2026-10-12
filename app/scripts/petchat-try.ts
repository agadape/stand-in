// Read a pets' chat without touching the chain or the database.
//
//   cd app && npx tsx --env-file=.env.local scripts/petchat-try.ts
import { davePersona, sarahPersona } from "../../scripts/fixtures.mjs";
import type { Persona } from "../src/lib/db/schema";
import { petChat } from "../src/lib/petchat";

const { ownerAddress: _unused, ...daveRest } = davePersona("0x0");
void _unused;
const dave: Persona = { version: 1, ...daveRest };

const { ownerAddress: _unused2, ...sarahRest } = sarahPersona("0x0");
void _unused2;
const sarah: Persona = { version: 1, ...sarahRest };

async function main() {
  const started = Date.now();
  const { chat, model } = await petChat(dave, sarah);
  for (const m of chat.messages) console.log(`${m.from === "a" ? "Dave " : "Sarah"}: ${m.text}`);
  console.log(`\nchemistry ${chat.chemistry}  |  ${chat.summary}  |  ${model}, ${Date.now() - started} ms`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
