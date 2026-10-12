// End-to-end test of meeting: two people make pets, both say yes, the pets chat and the
// bond goes on-chain.
//
//   node scripts/meet-e2e.mjs [baseUrl]      (default http://localhost:3000)
//
// Throwaway keys stand in for passkeys. Costs two pet creations and one bond
// (~0.4 testnet MON in gas top-ups) and one to three chat-model calls; no judge calls.
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
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json.error ?? json)}`);
  return json;
}

async function makePet(persona) {
  const owner = privateKeyToAccount(generatePrivateKey());
  const { slug } = await call("POST", "/api/twins", persona(owner.address));
  return { owner, slug };
}

async function befriend(me, other) {
  const issuedAt = Date.now();
  const message = `Stand-In\nslug: ${me.slug}\naction: bond:${other.slug}\nissued: ${issuedAt}`;
  const signature = await me.owner.signMessage({ message });
  const { bond } = await call("POST", "/api/bonds", {
    from: me.slug,
    to: other.slug,
    address: me.owner.address,
    proof: { issuedAt, signature },
  });
  return bond;
}

const dave = await makePet(davePersona);
const sarah = await makePet(sarahPersona);
console.log(`dave   ${base}/t/${dave.slug}`);
console.log(`sarah  ${base}/t/${sarah.slug}`);

const first = await befriend(sarah, dave);
console.log(`sarah scans dave: bond ${first.id}, done=${first.done}`);
if (first.done) throw new Error("A bond must not complete on one yes");

// Someone else's signature must not be able to accept for Dave.
const forged = await befriend({ owner: sarah.owner, slug: dave.slug }, sarah).then(
  () => "ACCEPTED",
  (e) => e.message.split("-> ")[1],
);
console.log(`forged accept:   ${forged}`);
if (forged === "ACCEPTED") throw new Error("A stranger accepted on Dave's behalf");

const started = Date.now();
const second = await befriend(dave, sarah);
console.log(`dave accepts:    bond ${second.id}, done=${second.done}, ${Math.round((Date.now() - started) / 1000)}s`);
if (!second.done) throw new Error("The bond did not complete on the second yes");

const page = await fetch(`${base}/b/${second.id}`, { headers: bypass });
console.log(`bond page        ${base}/b/${second.id} -> ${page.status}`);
if (!page.ok) process.exit(1);
