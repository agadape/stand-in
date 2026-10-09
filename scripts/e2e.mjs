// End-to-end smoke test and judge calibration probe against a running app.
//
//   node scripts/e2e.mjs [baseUrl]      (default http://localhost:3000)
//
// Creates a twin ("Dave"), then plays three voices against it:
//   owner     Dave answering as himself                 -> sets the bar
//   friend    a decent imitation that overdoes his tics -> should land below the bar, not at zero
//   impostor  polite email voice                        -> should score near the floor
// A healthy judge orders them owner > friend > impostor with clear gaps.
//
// Throwaway keys stand in for passkeys; the owner proof is the same signed message the
// browser produces (app/src/lib/auth.ts). Costs three judge calls and ~0.35 testnet MON.
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { answersFor, davePersona } from "./fixtures.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "app/package.json"));
const { privateKeyToAccount, generatePrivateKey } = require("viem/accounts");

const base = (process.argv[2] ?? process.env.STANDIN_URL ?? "http://localhost:3000").replace(/\/$/, "");
const owner = privateKeyToAccount(generatePrivateKey());

// Vercel preview deployments sit behind Deployment Protection. Set STANDIN_BYPASS to the
// project's "Protection Bypass for Automation" secret to test one from the shell.
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

async function ownerProof(slug, action) {
  const issuedAt = Date.now();
  const message = `Stand-In\nslug: ${slug}\naction: ${action}\nissued: ${issuedAt}`;
  return { issuedAt, signature: await owner.signMessage({ message }) };
}

const persona = davePersona(owner.address);

const log = (label, value) => console.log(`${label.padEnd(13)} ${value}`);
const pct = (bps) => `${(bps / 100).toFixed(1)}%`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The judge returns 503 when every model in its chain is overloaded (routine on a free
// tier). Wait and resubmit, the same thing a player does by tapping "Send" again.
async function submitWithRetry(path, body, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      return await call("POST", path, body);
    } catch (error) {
      if (i >= tries || !/-> 503:/.test(error.message)) throw error;
      console.log(`  (judge unavailable, retry ${i}/${tries - 1} in 30s: ${error.message.split("-> ")[1]})`);
      await sleep(30_000);
    }
  }
}

async function attempt(slug, voice, displayName, address, proof) {
  const { scenarios } = await call("GET", `/api/twins/${slug}/scenarios`);
  const started = Date.now();
  const { attempt: a } = await submitWithRetry(`/api/twins/${slug}/attempts`, {
    mode: voice === "owner" ? "owner" : "challenger",
    address,
    displayName,
    scenarioIds: scenarios.map((s) => s.id),
    answers: answersFor(voice, scenarios),
    proof,
  });
  console.log(`\n${voice.toUpperCase()} (${displayName})  score ${pct(a.scoreBps)}  model ${a.llm.overall}/100  style ${Math.round(a.styleSimilarity * 100)}%${voice === "owner" ? "" : a.passed ? `  PASSED, paid ${Number(BigInt(a.paidWei)) / 1e18} MON` : "  caught"}  [${a.judgeModel}, ${((Date.now() - started) / 1000).toFixed(0)}s]`);
  log("  says", `"${a.llm.verdictLine}"`);
  a.llm.answers.forEach((t, i) => log("  tell", `${String(t.score).padStart(3)}  [${scenarios[i].id}] ${t.tell}`));
  a.styleNotes.forEach((n) => log("  style", n));
  log("  tx", a.txUrl);
  log("  page", `${base}/t/${slug}/a/${a.id}`);
  return a;
}

const created = await call("POST", "/api/twins", persona);
log("twin", `${base}/t/${created.slug}`);
log("twin wallet", created.twinAddress);
log("create tx", created.txHash);

const own = await attempt(created.slug, "owner", "Dave", owner.address, await ownerProof(created.slug, "prove"));

const pot = await call("POST", `/api/twins/${created.slug}/pot`, {
  address: owner.address,
  proof: await ownerProof(created.slug, "fund"),
});
console.log(`\npot           ${Number(BigInt(pot.potWei)) / 1e18} MON  ${pot.txUrl}`);

const friend = await attempt(created.slug, "friend", "Sarah", privateKeyToAccount(generatePrivateKey()).address);
const impostor = await attempt(created.slug, "impostor", "Greg", privateKeyToAccount(generatePrivateKey()).address);

const ordered = own.scoreBps > friend.scoreBps && friend.scoreBps > impostor.scoreBps;
console.log(`\nsummary       owner ${pct(own.scoreBps)} | friend ${pct(friend.scoreBps)} | impostor ${pct(impostor.scoreBps)}`);
console.log(`ordering      ${ordered ? "OK (owner > friend > impostor)" : "UNEXPECTED: check the prompt and style weights"}`);
process.exitCode = ordered ? 0 : 2;
