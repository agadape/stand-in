// Assertions for the style fingerprint. Run with: npx tsx src/lib/style.check.ts
// Kept dependency-free on purpose; CI runs it next to the type-check.
import assert from "node:assert/strict";
import { features, notes, similarity } from "./style";

const dave = features([
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
]);

// Dave says "I" twice ("im", "i'll"), both lowercase.
assert.equal(dave.firstPerson, 2 / 12);
assert.equal(dave.lowerI, 1);
assert.ok(dave.lowerStart > 0.9);

const email = features([
  "My apologies, I am running approximately 20 minutes behind schedule.",
  "I would suggest Italian, if everyone is okay with that.",
  "Certainly, I can send it over today.",
]);
assert.equal(email.firstPerson, 1);
assert.equal(email.lowerI, 0);

// An email voice must not look "mostly similar" to a lowercase texter (the old floor was ~0.65).
assert.ok(similarity(dave, email) < 0.2, `email similarity too high: ${similarity(dave, email)}`);
// Dave's own kind of texts should score high against himself.
const daveAgain = features(["omw fr this time. like 5 min", "yo ok that actually looks good", "nahh ur not. coming over"]);
assert.ok(similarity(dave, daveAgain) > 0.6, `owner similarity too low: ${similarity(dave, daveAgain)}`);
assert.equal(similarity(dave, dave), 1);

// Evidence about "I" appears only when both sides wrote it, and says the true thing.
const emailNotes = notes("Dave", dave, email);
assert.ok(emailNotes.some((n) => n.includes('writes "i" lowercase')), emailNotes.join(" | "));
const noI = features(["bro lol so cute fr", "lmaooo no way"]);
assert.equal(noI.firstPerson, 0);
assert.ok(!notes("Dave", dave, noI).some((n) => /"i"|"I"/.test(n)), "claimed something about I without evidence");

// "ill" (sick) and words containing i are not first person.
assert.equal(features(["this is it", "feeling ill today"]).firstPerson, 0);
assert.equal(features(["I'm in", "Ive seen it"]).lowerI, 0);

// Public pages name the candidate instead of saying "You".
assert.ok(notes("Dave", dave, email, "Greg").every((n) => !n.includes("You")));

console.log("style checks passed");
