// Assertions for the model-free judge. Run with: npx tsx src/lib/stylometry.check.ts
// Dependency-free; CI runs it next to the other checks.
import assert from "node:assert/strict";
import type { Persona } from "./db/schema";
import { stylometry } from "./stylometry";

const rina: Persona = {
  version: 1,
  name: "Rina",
  bio: "",
  samples: [
    "gak bisa wkwk",
    "udh makan blm",
    "gue otw ya",
    "anjir telat bgt",
    "iya sih tp gak gitu jg",
    "wkwkwk ngakak",
    "bentar gue mandi dulu",
    "yaudah deh",
    "lo dmn",
    "gak tau deh gue jg bingung",
  ],
  quiz: [{ question: "How do you say hi in a text?", answer: "woi" }],
};
const scenarios = [
  { id: "a", prompt: "A" },
  { id: "b", prompt: "B" },
  { id: "c", prompt: "C" },
];
const score = (answers: string[], strict = true) => stylometry(rina, scenarios, answers, strict);

const herself = score(["gak ah males wkwk", "udh gue bilang kan", "iya bentar gue otw"], false);
const friend = score(["nggak ah males haha", "sudah aku bilang kan", "iya bentar aku otw"]);
const stranger = score(["Tidak, saya sedang malas.", "Sudah saya katakan sebelumnya.", "Baik, saya akan segera berangkat."]);

// The order a fair judge must keep, with room between them.
assert.ok(herself.score > friend.score + 10, `owner ${herself.score} vs friend ${friend.score}`);
assert.ok(friend.score > stranger.score + 10, `friend ${friend.score} vs stranger ${stranger.score}`);

// Same input, same score: the whole point of having no model.
assert.deepEqual(score(["nggak ah males haha", "sudah aku bilang kan", "iya bentar aku otw"]), friend);

// The spelling you pick is named as the tell, with hers beside it.
assert.match(friend.llm.answers[0].tell, /"nggak".*"gak"/);
assert.ok(friend.style.notes.some((n) => /haha.*wkwk/.test(n)), friend.style.notes.join(" | "));
// A stretched laugh or word is the same choice, not a different one.
assert.ok(!score(["gakkk wkwkwkwk", "udh", "iya"]).style.notes.some((n) => /"gak+"/.test(n)));

// Copying her real texts earns nothing, but only for challengers.
const cheat = score(["gak tau deh gue jg bingung", "iya sih tp gak gitu jg", "anjir telat bgt"]);
assert.equal(cheat.score, 0);
assert.match(cheat.llm.answers[0].tell, /Copied/);
assert.ok(score(["gak tau deh gue jg bingung", "iya sih tp gak gitu jg", "anjir telat bgt"], false).score > 60);
// One copied answer costs that answer, not the whole attempt.
const partly = score(["gak tau deh gue jg bingung", "udh gue bilang kan", "iya bentar gue otw"]);
assert.ok(partly.score > 0 && partly.score < herself.score, String(partly.score));

// Nothing longer than a single word of hers is ever shown.
for (const text of [...friend.llm.answers.map((a) => a.tell), ...friend.style.notes, friend.llm.verdictLine]) {
  for (const sample of rina.samples.filter((s) => s.split(" ").length > 1)) assert.ok(!text.includes(sample), text);
}

console.log(`stylometry checks passed (owner ${herself.score}, friend ${friend.score}, stranger ${stranger.score})`);
