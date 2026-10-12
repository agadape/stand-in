// End-to-end test of Proof of Met: rotating codes, in-person meetings on the contract,
// a gathering, and a met-gated room that turns someone away until enough members met them.
//
//   node scripts/met-e2e.mjs [baseUrl]      (default http://localhost:3000)
//
// Throwaway keys stand in for passkeys. Costs three pet creations, three meetings, a
// gathering, a room and two joins (about 1 testnet MON in gas top-ups) and a few
// chat-model calls; no judge calls.
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { davePersona, sarahPersona } from "./fixtures.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "app/package.json"));
const { privateKeyToAccount, generatePrivateKey } = require("viem/accounts");

const base = (process.argv[2] ?? process.env.STANDIN_URL ?? "http://localhost:3000").replace(/\/$/, "");
const bypass = process.env.STANDIN_BYPASS ? { "x-vercel-protection-bypass": process.env.STANDIN_BYPASS } : {};

async function call(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", ...bypass },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json.error ?? json)}`);
    error.status = res.status;
    throw error;
  }
  return json;
}

const refused = (promise) => promise.then(() => null, (e) => e.status);
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) process.exitCode = 1;
};

async function proof(pet, action) {
  const issuedAt = Date.now();
  const message = `Stand-In\nslug: ${pet.slug}\naction: ${action}\nissued: ${issuedAt}`;
  return { slug: pet.slug, address: pet.owner.address, proof: { issuedAt, signature: await pet.owner.signMessage({ message }) } };
}

async function makePet(persona, name) {
  const owner = privateKeyToAccount(generatePrivateKey());
  const { slug } = await call("POST", "/api/twins", { ...persona(owner.address), ...(name ? { name } : {}) });
  console.log(`     ${(name ?? persona(owner.address).name).padEnd(6)} ${base}/t/${slug}`);
  return { owner, slug };
}

/** The code `pet` has on screen right now. */
async function showCode(pet, gatheringId = 0) {
  const { slug, ...auth } = await proof(pet, "code");
  const { codes } = await call("POST", `/api/twins/${slug}/codes`, { ...auth, gatheringId });
  return codes[0];
}

async function scan(me, other, code, gatheringId = 0) {
  const { slug, address, proof: p } = await proof(me, `bond:${other.slug}`);
  const { bond } = await call("POST", "/api/bonds", { from: slug, to: other.slug, address, proof: p, code, gatheringId });
  return bond;
}

console.log("pets");
const dave = await makePet(davePersona);
const sarah = await makePet(sarahPersona);
const greg = await makePet(sarahPersona, "Greg");

console.log("\nrotating codes");
const stranger = await refused(call("POST", `/api/twins/${dave.slug}/codes`, { ...(await proof({ ...sarah, slug: dave.slug }, "code")), slug: undefined }));
check("only the owner can fetch a pet's codes", stranger === 401, `stranger got ${stranger}`);

const code = await showCode(dave);
let started = Date.now();
const first = await scan(sarah, dave, code);
check("one scan of a fresh code completes the friendship", first.done, `${Math.round((Date.now() - started) / 1000)}s`);
check("the same code cannot be used again", (await refused(scan(greg, dave, code))) === 410);
const stale = { ...(await showCode(dave)), issuedAt: Math.floor(Date.now() / 1000) - 600 };
check("a code with a changed time is rejected", (await refused(scan(greg, dave, stale))) === 410);

console.log("\ngathering");
const { id: gatheringId } = await call("POST", "/api/gatherings", { ...(await proof(dave, "gathering:create")), name: "Test night", hours: 1 });
check("a pet can host a gathering", gatheringId > 0, `id ${gatheringId}`);
const second = await scan(greg, dave, await showCode(dave, gatheringId), gatheringId);
check("a meeting at the gathering completes", second.done);

console.log("\nmet-gated room");
const { id: roomId } = await call("POST", "/api/rooms", { ...(await proof(dave, "room:create")), name: "Inner Circle", threshold: 2, inPersonOnly: true });
check("a pet can open a room", roomId > 0, `id ${roomId}`);

await call("POST", `/api/rooms/${roomId}/join`, await proof(sarah, `room:join:${roomId}`));
check("Sarah, who met the only member, gets in", (await call("GET", `/api/rooms/${roomId}/join?slug=${sarah.slug}`)).member);

const before = await call("GET", `/api/rooms/${roomId}/join?slug=${greg.slug}`);
check("Greg has 1 of 2 vouches", !before.ok && before.vouches === 1 && before.needed === 2, JSON.stringify(before));
check("the room turns Greg away", (await refused(call("POST", `/api/rooms/${roomId}/join`, await proof(greg, `room:join:${roomId}`)))) === 403);

const third = await scan(greg, sarah, await showCode(sarah));
check("Greg meets Sarah in person", third.done);
const after = await call("GET", `/api/rooms/${roomId}/join?slug=${greg.slug}`);
check("now Greg has 2 of 2", after.ok && after.vouches === 2, JSON.stringify(after));
const joined = await call("POST", `/api/rooms/${roomId}/join`, await proof(greg, `room:join:${roomId}`));
check("and the room lets Greg in", Boolean(joined.txUrl), joined.txUrl);

console.log("\nwall");
const all = await call("GET", "/api/wall");
const night = await call("GET", `/api/wall?g=${gatheringId}`);
check("the wall reads meetings from the contract", all.counts.meets >= 3, JSON.stringify(all.counts));
check("the gathering's wall has just its own meeting", night.counts.meets === 1 && night.counts.pets === 2, JSON.stringify(night.counts));

console.log(`\nroom       ${base}/r/${roomId}\ngathering  ${base}/e/${gatheringId}\nbond       ${base}/b/${first.id}`);
