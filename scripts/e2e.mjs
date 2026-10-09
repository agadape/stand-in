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

// One answer per scenario id (app/src/lib/scenarios.ts) for each voice: [owner, friend, impostor].
const VOICES = {
  "ride-2am": ["bro its 2am. where r u. ok omw", "bro lol its so late, fine im coming omw fr fr", "Of course! I'll be there in about 15 minutes. Stay safe."],
  dinner: ["idk anything but that mid place again", "idk bro anything is fine lol, maybe pizza?", "I would suggest Italian, if everyone is okay with that."],
  haircut: ["yo ok that actually looks good", "lmaooo bro what did u do. jk it looks good fr", "It looks wonderful! The new style really suits you."],
  "boss-sunday": ["hey whats up", "yo boss whats up lol", "Good afternoon! Certainly, how may I help you?"],
  saturday: ["sleep til noon. food. nothing. perfect", "bro honestly just sleeping and eating lol, thats it fr", "A morning hike, followed by brunch and a good book in the evening."],
  late: ["omw fr this time. like 5 min", "omw bro i swear lol, 5 minutes fr fr", "My apologies, I am running approximately 20 minutes behind schedule."],
  outfit: ["lol the shoes tho. 7", "bro lmaooo its a 6 fr, change the shoes", "I think it looks very stylish. I would rate it an 8 out of 10."],
  "doing-rn": ["nothing man. staring at the ceiling", "nothing bro lol, just chilling fr", "I am currently catching up on some reading and emails."],
  "im-fine": ["nahh ur not. coming over, want food", "bro u sure? lol i can come over if u want", "I'm so sorry to hear that. I'm here if you would like to talk."],
  "food-take": ["cereal is better at night fr", "bro pizza with mayo is good fr, dont @ me lol", "I believe that breakfast foods are perfectly acceptable for dinner."],
  "borrow-50": ["bro i got like 12. u can have 12", "lol bro i am broke too fr, maybe 20?", "Certainly, I can send it over today. Please don't worry about it."],
  pineapple: ["its fine idk why ppl are so mad", "lmaooo bro its mid fr, not good not bad", "I think it's a matter of personal taste, though I do enjoy it."],
  business: ["lol doing what. ok im in tho", "bro lol yes lets do it fr, what business tho", "That is an interesting idea! What kind of business did you have in mind?"],
  "seen-it": ["lmaooo ive seen this 3 times still good", "lmaooo bro i saw this already fr", "Thank you for sharing! I have seen this one, it's very amusing."],
  song: ["that one from the ad idk the name", "bro idk lol some tiktok song fr", "I have had a lovely jazz piece stuck in my head all day."],
  driving: ["not me. my car is cursed", "not me bro lol, im always late fr", "I would be happy to drive tonight. What time should we leave?"],
  coffee: ["iced. always. even when its cold", "iced coffee bro, always fr", "I take my coffee black, with one sugar. Thank you for asking!"],
  "lost-game": ["nahhh u got lucky. rematch", "bro u cheated lol, rematch fr fr", "Congratulations on a well-played game! You truly deserved the win."],
  "10k": ["new laptop then idk food for everyone", "bro lol i would buy a ps5 and a trip fr", "I would book a weekend trip and donate a portion to charity."],
  "comfort-show": ["the office. dont make me explain", "the office bro lol, classic fr", "I enjoy nature documentaries because they are very relaxing."],
  "gym-6am": ["lol no. 6pm maybe", "lmaooo bro no way, 6am is crazy fr", "That sounds great! I will set my alarm and see you there."],
  dog: ["yo i just saw the best dog. huge. fluffy", "bro i saw a dog lol so cute fr", "I just saw the most adorable golden retriever on Main Street!"],
  boat: ["boat. just boat", "lol bro idk, boaty mcboatface fr", "I would name it Serenity, as it evokes a sense of calm."],
  "most-you": ["said omw from my bed again", "bro i was late again lol, classic me fr", "I organised my entire bookshelf alphabetically this week."],
};
const VOICE_INDEX = { owner: 0, friend: 1, impostor: 2 };

function answersFor(voice, scenarios) {
  return scenarios.map((s) => {
    const row = VOICES[s.id];
    if (!row) throw new Error(`e2e has no fixture for scenario "${s.id}"; add one to VOICES`);
    return row[VOICE_INDEX[voice]];
  });
}

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
