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

// The session cookie, once signed in. Sent with every later request, as a browser would.
let cookie = "";
async function call(method, path, body, { redirect = "follow" } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    redirect,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, location: res.headers.get("location"), setCookie: res.headers.get("set-cookie"), json: await res.json().catch(() => ({})) };
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

// The world is for residents. Without a session there is no page and no data.
const shutOut = await call("GET", "/api/world");
check(shutOut.status === 401 && !shutOut.json.agents, "the world's data is refused to someone not signed in", String(shutOut.status));
const door = await call("GET", "/world", undefined, { redirect: "manual" });
check([302, 303, 307, 308].includes(door.status) && (door.location ?? "").includes("/enter"), "the world page sends them to the door", `${door.status} -> ${door.location}`);
// A visitor's pages carry no navigation at all: it is not in the HTML to be un-hidden.
const page = async (path) => (await fetch(`${base}${path}`, { headers: cookie ? { cookie } : {} })).text();
const hasNav = (html) => /aria-label="Main"|aria-label="Your pet"|>\s*Wardrobe\s*<|>\s*Activity\s*<|href="\/rooms"|href="\/wall"/.test(html);
check(!hasNav(await page("/")), "the landing page sent to a visitor contains no navigation");
check(!hasNav(await page("/enter")), "nor does the door");
// A pet's public page links to that pet's wardrobe and activity in its own content; what it must not have is the app's menu.
check(!/aria-label="Main"|aria-label="Your pet"/.test(await page(`/t/${dave.slug}`)), "a pet's public page has no menu for a visitor");
check(/Enter the World/.test(await page("/")), "the landing page has the way in");

// Anyone may watch; only residents act. The public window shows the town and leaves out
// who owns a pet and whether one human has said yes to an introduction.
const watch = await call("GET", "/api/world/watch");
const watchJson = JSON.stringify(watch.json);
check(watch.status === 200 && watch.json.agents?.length > 0 && Array.isArray(watch.json.events), "anyone may watch the town", `${watch.json.agents?.length} agents`);
check(!watchJson.includes("ownerAddress") && !watchJson.toLowerCase().includes(dave.owner.address.toLowerCase()), "what a watcher gets names no owner");
check(!watchJson.includes("aConsent") && !watchJson.includes("bConsent"), "nor whether one human has said yes to an introduction");
check(!watchJson.includes('"avoid"'), "nor the topics an owner asked their pet to avoid");
check((await call("POST", "/api/world/watch", { place: "lake" })).status === 405, "there is nothing to post to the watch route");
const watchPage = await page("/watch");
check(/You(&#x27;|')re watching the Isekai/.test(watchPage) && !hasNav(watchPage), "the watch page says what it is and has no navigation");
check(!watchPage.includes("ownerAddress") && !watchPage.includes("aConsent") && !/Save dials|Change the weather|Yes, introduce us|Show my code/.test(watchPage), "and it carries no owner, no consent and nothing to act with");
check(/Watch the town/.test(await page("/")), "the landing page links to it");
check((await call("GET", "/api/world")).status === 401, "the resident's world is still refused to a watcher");
check((await call("GET", "/api/world/letter?since=0")).status === 401, "a pet's letter is refused to someone not signed in");
// Rooms and the wall are for residents too: a visitor is sent to the door and gets no data.
for (const path of ["/rooms", "/wall", "/r/1", "/e/1"]) {
  const r = await call("GET", path, undefined, { redirect: "manual" });
  check([302, 303, 307, 308].includes(r.status) && decodeURIComponent(r.location ?? "").endsWith(`/enter?next=${path}`), `${path} sends a visitor to the door`, `${r.status} -> ${r.location}`);
}
check((await call("GET", "/api/wall")).status === 401, "the wall's data is refused to a visitor");
check((await call("GET", `/api/rooms/1/join?slug=${dave.slug}`)).status === 401, "so is asking whether a pet may join a room");
cookie = "standin_session=dave-forged.9999999999.deadbeef";
check(!hasNav(await page("/")), "a made-up session cookie gets no navigation either");
check((await call("GET", "/api/world")).status === 401, "a made-up session cookie is refused");
cookie = "";
const wrongKey = await call("POST", "/api/session", await signed(dave, "session", sarah.owner));
check(wrongKey.status === 401 && !wrongKey.setCookie, "signing in as someone else's pet is refused", String(wrongKey.status));
const reused = await call("POST", "/api/session", await signed(dave, "world:dials"));
check(reused.status === 401, "a signature made for another action cannot sign in", String(reused.status));
const signedIn = await call("POST", "/api/session", await signed(dave, "session"));
cookie = (signedIn.setCookie ?? "").split(";")[0];
check(signedIn.status === 200 && cookie.startsWith("standin_session=") && /HttpOnly/i.test(signedIn.setCookie ?? ""), "the owner's passkey signature signs in (httpOnly cookie)");
check((await call("GET", "/world", undefined, { redirect: "manual" })).status === 200, "signed in, the world page opens");
check((await call("GET", "/api/session")).json.pet?.slug === dave.slug, "the session knows which pet it is");
const home = await call("GET", "/watch", undefined, { redirect: "manual" });
check([302, 303, 307, 308].includes(home.status) && (home.location ?? "").endsWith("/world"), "a resident who opens the watch page is sent home", `${home.status} -> ${home.location}`);
check(hasNav(await page("/world")) && hasNav(await page(`/t/${dave.slug}`)), "signed in, the navigation is there");
check((await call("GET", "/rooms", undefined, { redirect: "manual" })).status === 200 && (await call("GET", "/api/wall")).status === 200, "signed in, rooms and the wall open");

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

// Weather: the one thing money buys. It names a kind of weather and nothing else.
// A clear sky to start from, so the script can be run twice in a row.
await local.execute("update world_clock set weather_kind = null, weather_by = null, weather_started_tick = null, weather_until_tick = null, weather_tx = null");
const weather = (body) => call("POST", "/api/world/weather", body);
check((await weather({ slug: dave.slug, kind: "storm" })).status === 400, "weather without an owner's proof is refused");
const notMine = await weather({ ...(await signed(dave, "world:weather:storm", sarah.owner)), kind: "storm" });
check(notMine.status === 401, "someone else's signature cannot buy weather as Dave", String(notMine.status));
const otherKind = await weather({ ...(await signed(dave, "world:weather:festival")), kind: "storm" });
check(otherKind.status === 401, "a signature for a festival cannot buy a storm", String(otherKind.status));
for (const extra of [{ agentId: b.id }, { place: "lake" }, { pairId: 1 }]) {
  const r = await weather({ ...(await signed(dave, "world:weather:storm")), kind: "storm", ...extra });
  check(r.status === 400, `a weather request that also names ${Object.keys(extra)[0]} is refused`, String(r.status));
}
world = (await call("GET", "/api/world")).json;
check(world.weather === null && world.weatherReadyInTicks === 0, "none of those refusals touched the sky");
const storm = await weather({ ...(await signed(dave, "world:weather:storm")), kind: "storm" });
check(storm.status === 200 && /^0x[0-9a-f]{64}$/.test(storm.json.txHash ?? ""), "Dave's owner buys a thunderstorm, paid by the pet's wallet", storm.json.txUrl ?? JSON.stringify(storm.json));
world = (await call("GET", "/api/world")).json;
check(world.weather?.kind === "storm" && world.weather.byName === "Dave" && world.weather.place === "tavern", "the town has a storm, credited to the pet by name", JSON.stringify(world.weather));
check(!JSON.stringify(world.weather).includes(dave.owner.address), "and not to anyone's address");
check(world.events.some((e) => e.kind === "weather" && e.text.includes("thunderstorm")), "the chronicle says who changed the weather");
const again = await weather({ ...(await signed(sarah, "world:weather:festival")), kind: "festival" });
check(again.status === 409 && again.json.readyInTicks > 0, "a second purchase straight after is refused, with how long to wait", JSON.stringify(again.json));
// Nobody was sent anywhere. They go because of the storm, each by their own rules.
let sheltering = 0;
let awake = 0;
for (let i = 0; i < 15 && !(awake && sheltering * 2 >= awake); i++) {
  await sleep(3000);
  world = (await call("GET", "/api/world")).json;
  awake = world.agents.filter((x) => !x.paused).length;
  sheltering = world.agents.filter((x) => !x.paused && x.place === "tavern").length;
}
check(sheltering * 2 >= awake, "within 45 seconds at least half the town is in the tavern", `${sheltering} of ${awake}`);
const stormTalk = world.events.find((e) => e.kind === "talk" && e.lines && /storm|thunder|rain|lightning|wet|soaked|dry/i.test(JSON.stringify(e.lines)));
console.log(stormTalk ? `     a talk mentions it: ${JSON.stringify(stormTalk.lines.slice(0, 2))}` : "     (no talk has mentioned the storm yet)");

// The letter is for the signed-in pet only, and there is no way to name another.
const letter = await call("GET", `/api/world/letter?since=0&slug=${sarah.slug}`);
check(letter.status === 200 && "letter" in letter.json, "signed in, the owner can ask for their pet's letter", letter.json.letter ? `${letter.json.byModel ? "model" : "plain"}: ${letter.json.letter.slice(0, 110)}` : "nothing to tell yet");
check(!JSON.stringify(letter.json).includes("omw"), "and it carries none of the owner's texts");

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

// Leaving. Deleting needs the session of that very pet and its name typed out.
const del = (slug, body, withCookie = cookie) =>
  fetch(`${base}/api/twins/${slug}`, { method: "DELETE", headers: { "content-type": "application/json", ...(withCookie ? { cookie: withCookie } : {}) }, body: JSON.stringify(body) });
check((await del(dave.slug, { confirm: "Dave" }, "")).status === 401, "a pet cannot be deleted by someone not signed in");
check((await del(sarah.slug, { confirm: "Sarah" })).status === 403, "nor by someone signed in as another pet");
check((await del(dave.slug, { confirm: "nope" })).status === 400, "nor without typing its name");
const gone = await del(dave.slug, { confirm: "dave" });
check(gone.status === 200 && /standin_session=;/.test(gone.headers.get("set-cookie") ?? ""), "its owner can delete it, and is signed out");
check((await call("GET", `/api/twins/${dave.slug}`)).status === 404 && (await call("GET", "/api/world")).status === 401, "the pet is gone and its session opens nothing");
cookie = "";
const after = (await call("GET", "/api/world/watch")).json;
check(!after.agents.some((x) => x.slug === dave.slug) && after.agents.some((x) => x.slug === sarah.slug), "it has left the town; the others are still there");

console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
