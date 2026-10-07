// End-to-end smoke test against a running app: create a twin, prove the owner, fund a
// demo pot, send a challenger, print verdicts and transaction links.
//
//   node scripts/e2e.mjs [baseUrl]      (default http://localhost:3000)
//
// Throwaway keys stand in for passkeys: the owner proof is the same signed message the
// browser produces (see app/src/lib/auth.ts). Costs one judge call per attempt.
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "app/package.json"));
const { privateKeyToAccount, generatePrivateKey } = require("viem/accounts");

const base = (process.argv[2] ?? process.env.STANDIN_URL ?? "http://localhost:3000").replace(/\/$/, "");
const owner = privateKeyToAccount(generatePrivateKey());
const challenger = privateKeyToAccount(generatePrivateKey());

async function call(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json.error ?? json)}`);
  return json;
}

async function ownerProof(slug, action) {
  const issuedAt = Date.now();
  const message = `Stand-In\nslug: ${slug}\naction: ${action}\nissued: ${issuedAt}`;
  const signature = await owner.signMessage({ message });
  return { issuedAt, signature };
}

const persona = {
  name: "Dave",
  bio: "chronically late, allergic to capital letters",
  ownerAddress: owner.address,
  samples: [
    "omw",
    "lol no",
    "wait what time is it",
    "ok ok ok im leaving now fr",
    "bro",
    "idk man that place was mid",
    "can u grab me one too",
    "lmaooo",
    "i'll be there in 5 (its 15)",
    "nahhh",
    "yo did u see that",
    "down. where",
  ],
  quiz: [
    { question: "How do you say hi in a text?", answer: "yo" },
    { question: "What do you type when something is actually funny?", answer: "lmaooo" },
    { question: "Describe your weekend in one text.", answer: "slept. ate. regret." },
    { question: "A word or phrase you overuse?", answer: "fr" },
    { question: "Something you would never say?", answer: "Kind regards" },
    { question: "Your go-to text when you're running late.", answer: "omw (not omw)" },
  ],
};

// Answers in Dave's own voice: lowercase, short, abbreviations.
const asDave = (prompt) => {
  if (/2:07am|ride/.test(prompt)) return "bro its 2am. where r u. fine omw";
  if (/dinner/.test(prompt)) return "idk whatever. not pizza again tho";
  if (/late/.test(prompt)) return "omw fr this time. 5 min";
  return "lol idk man. down for whatever";
};

// A challenger who writes like an email.
const asImpostor = (prompt) => {
  if (/2:07am|ride/.test(prompt)) return "Of course! I'll be there in about 15 minutes. Stay safe.";
  if (/dinner/.test(prompt)) return "I would suggest Italian, if everyone is okay with that.";
  return "That sounds great, let me know the details and I'll make it work.";
};

const log = (label, value) => console.log(`${label.padEnd(14)} ${value}`);

const created = await call("POST", "/api/twins", persona);
log("twin", `${base}/t/${created.slug}`);
log("twin wallet", created.twinAddress);
log("create tx", created.txHash);

let { scenarios } = await call("GET", `/api/twins/${created.slug}/scenarios`);
const ownerAttempt = await call("POST", `/api/twins/${created.slug}/attempts`, {
  mode: "owner",
  address: owner.address,
  displayName: "Dave",
  scenarioIds: scenarios.map((s) => s.id),
  answers: scenarios.map((s) => asDave(s.prompt)),
  proof: await ownerProof(created.slug, "prove"),
});
log("owner score", `${(ownerAttempt.attempt.scoreBps / 100).toFixed(1)}%  "${ownerAttempt.attempt.llm.verdictLine}"`);
log("owner tx", ownerAttempt.attempt.txUrl);

const pot = await call("POST", `/api/twins/${created.slug}/pot`, {
  address: owner.address,
  proof: await ownerProof(created.slug, "fund"),
});
log("pot", `${Number(BigInt(pot.potWei)) / 1e18} MON  ${pot.txUrl}`);

({ scenarios } = await call("GET", `/api/twins/${created.slug}/scenarios`));
const challenge = await call("POST", `/api/twins/${created.slug}/attempts`, {
  mode: "challenger",
  address: challenger.address,
  displayName: "Sarah",
  scenarioIds: scenarios.map((s) => s.id),
  answers: scenarios.map((s) => asImpostor(s.prompt)),
});
const a = challenge.attempt;
log("challenger", `${(a.scoreBps / 100).toFixed(1)}%  ${a.passed ? "PASSED" : "caught"}  paid ${Number(BigInt(a.paidWei)) / 1e18} MON`);
log("verdict line", `"${a.llm.verdictLine}"`);
for (const t of a.llm.answers) log("  tell", `${t.score}  ${t.tell}`);
for (const n of a.styleNotes) log("  style", n);
log("challenge tx", a.txUrl);

const board = await call("GET", `/api/twins/${created.slug}`);
log("leaderboard", board.leaderboard.map((r) => `${r.displayName} ${(r.scoreBps / 100).toFixed(1)}%`).join(", "));
