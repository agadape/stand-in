// End-to-end test of the Isekai against a local server and its local database.
//
//   node scripts/world-e2e.mjs [baseUrl]      (default http://localhost:3000)
//
// Makes two pets, waits for them to move into the town, and checks what an owner can and
// cannot do: dials need the owner's signature, there is no way to command an agent, an
// introduction needs both humans' yes, and the second yes writes it to ProofOfMet.
//
// The world would take a long while to bring two given pets past the threshold, so the
// script sets that pair's score directly in the LOCAL database file (app/standin.db). It
// therefore only works against a local server. Costs two pets and one transaction.
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { davePersona, sarahPersona } from "./fixtures.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "app/package.json"));
const { privateKeyToAccount, generatePrivateKey } = require("viem/accounts");
const { createClient } = require("@libsql/client");

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const local = createClient({ url: `file:${join(root, "app/standin.db")}` });
let failed = 0;
const check = (ok, label, extra = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${extra ? `  (${extra})` : ""}`);
  if (!ok) failed++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, path, body) {
  const res = await fetch(`${base}${path}`, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function makePet(persona) {
  const owner = privateKeyToAccount(generatePrivateKey());
  const { status, json } = await call("POST", "/api/twins", persona(owner.address));
  if (status !== 200) throw new Error(`create pet -> ${status}: ${JSON.stringify(json)}`);
  return { owner, slug: json.slug };
}

async function signed(pet, action, signer = pet.owner) {
  const issuedAt = Date.now();
  const signature = await signer.signMessage({ message: `Stand-In\nslug: ${pet.slug}\naction: ${action}\nissued: ${issuedAt}` });
  return { slug: pet.slug, address: signer.address, proof: { issuedAt, signature } };
}

const dave = await makePet(davePersona);
const sarah = await makePet(sarahPersona);
console.log(`dave ${dave.slug}, sarah ${sarah.slug}\n`);

// The town takes new pets in within a few ticks; watching it is what makes it tick.
let world, a, b;
for (let i = 0; i < 12 && !(a && b); i++) {
  world = (await call("GET", "/api/world")).json;
  a = world.agents?.find((x) => x.slug === dave.slug);
  b = world.agents?.find((x) => x.slug === sarah.slug);
  if (!(a && b)) await sleep(4000);
}
check(Boolean(a && b), "both pets moved into the town on their own", `tick ${world.tick}`);
if (!(a && b)) process.exit(1);
check(!JSON.stringify(a).includes("omw") && a.voice.length > 0, "the town's card describes the voice and carries none of the texts", a.voice);

const dials = { openness: 90, pace: 80, avoid: "work", paused: false };
const stranger = await call("POST", "/api/world/dials", { ...(await signed(dave, "world:dials", sarah.owner)), dials, interests: ["football"] });
check(stranger.status === 401, "someone else's signature cannot turn Dave's dials", String(stranger.status));
const mine = await call("POST", "/api/world/dials", { ...(await signed(dave, "world:dials")), dials, interests: ["football", "spicy food"] });
check(mine.status === 200, "Dave's owner can turn the dials", JSON.stringify(mine.json.dials ?? mine.json));
world = (await call("GET", "/api/world")).json;
a = world.agents.find((x) => x.slug === dave.slug);
check(a.openness === 90 && a.interests.includes("football"), "the dials and interests show on the agent");
check(!JSON.stringify(world).includes('"avoid"') && !JSON.stringify(a).includes("work"), "topics to avoid are not sent to browsers");

for (const path of ["/api/world/move", "/api/world/say", "/api/world/command"]) {
  const r = await call("POST", path, { ...(await signed(dave, "world:dials")), place: "lake", text: "go to the lake" });
  check(r.status === 404 || r.status === 405, `there is no ${path} to command an agent with`, String(r.status));
}

// Bring this one pair to the threshold directly, then test the consent gate.
const [lo, hi] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
await local.execute({ sql: "delete from world_pairs where a_id = ? and b_id = ?", args: [lo, hi] });
await local.execute({ sql: "insert into world_pairs (a_id, b_id, score, encounters, last_summary, a_consent, b_consent, updated_at) values (?, ?, 40, 3, 'test', 0, 0, ?)", args: [lo, hi, Date.now()] });
world = (await call("GET", "/api/world")).json;
let pair = world.pairs.find((p) => p.aId === lo && p.bId === hi);
const early = await call("POST", "/api/world/consent", { ...(await signed(dave, `world:consent:${pair.id}`)), pairId: pair.id });
check(early.status === 409, "no introduction before they have grown close", String(early.status));

await local.execute({ sql: "update world_pairs set score = 85 where id = ?", args: [pair.id] });
const first = await call("POST", "/api/world/consent", { ...(await signed(dave, `world:consent:${pair.id}`)), pairId: pair.id });
check(first.status === 200 && first.json.introduced === false, "one yes does not introduce anyone", JSON.stringify(first.json));
const forged = await call("POST", "/api/world/consent", { ...(await signed(sarah, `world:consent:${pair.id}`, dave.owner)), pairId: pair.id });
check(forged.status === 401, "Dave cannot say yes on Sarah's behalf", String(forged.status));
const started = Date.now();
const second = await call("POST", "/api/world/consent", { ...(await signed(sarah, `world:consent:${pair.id}`)), pairId: pair.id });
check(second.status === 200 && second.json.introduced === true, "the second yes makes the introduction", `${Math.round((Date.now() - started) / 1000)}s`);

world = (await call("GET", "/api/world")).json;
pair = world.pairs.find((p) => p.aId === lo && p.bId === hi);
check(pair.introduced && Boolean(pair.txUrl), "and it is recorded on Monad by the two pets' wallets", pair.txUrl ?? "no transaction");
check(world.events.some((e) => e.kind === "intro"), "the chronicle says so");

const paused = await call("POST", "/api/world/dials", { ...(await signed(dave, "world:dials")), dials: { ...dials, paused: true }, interests: ["football"] });
world = (await call("GET", "/api/world")).json;
check(paused.status === 200 && world.agents.find((x) => x.slug === dave.slug).paused, "the owner can pull the agent out of the town");

console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
