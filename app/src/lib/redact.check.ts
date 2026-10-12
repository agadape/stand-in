// Assertions for keeping private persona text out of public verdicts.
// Run with: npx tsx src/lib/redact.check.ts (dependency-free; CI runs it).
import assert from "node:assert/strict";
import { redactPrivate, withoutPrivateText } from "./redact";

const privateTexts = ["slept. ate. regret.", "wait what time is it", "lol no", "omw", "i'll be there in 5 (its 15)"];

// The leak that prompted this: a tell quoting a quiz answer, seen on the live site.
assert.equal(
  redactPrivate("too formal for someone whose weekend was 'slept. ate. regret.'", privateTexts, []),
  "too formal for someone whose weekend was '…'",
);
// Case, apostrophes and punctuation do not hide a copy; part of a longer text counts too.
assert.equal(redactPrivate("He'd say Ill be there in 5, not this.", privateTexts, []), "He'd say … not this.");
// A whole two-word text is flagged; a single word never is.
assert.equal(redactPrivate('Dave would just send "lol no" here.', privateTexts, []), 'Dave would just send "…" here.');
assert.equal(redactPrivate('Missing his usual "omw".', privateTexts, []), 'Missing his usual "omw".');
// Two words out of a longer private text are not enough.
assert.equal(redactPrivate("Asks what time it starts.", privateTexts, []), "Asks what time it starts.");

// Words the candidate wrote themselves are theirs to be quoted back.
const candidate = ["wait what time is it lol"];
assert.equal(
  redactPrivate('Opening with "wait what time is it" is spot on.', privateTexts, candidate),
  'Opening with "wait what time is it" is spot on.',
);
// Ordinary prose passes through untouched.
const prose = 'Perfect capitalization and "I enjoy" is the opposite of Dave.';
assert.equal(redactPrivate(prose, privateTexts, candidate), prose);

const cleaned = withoutPrivateText(
  {
    answers: [{ scenarioId: "late", score: 3, tell: "Nothing like 'wait what time is it'." }],
    overall: 2,
    verdictLine: "slept ate regret, unlike u",
  },
  {
    version: 1,
    name: "Dave",
    bio: "chronically late, allergic to capital letters",
    samples: privateTexts,
    quiz: [{ question: "Describe your weekend in one text.", answer: "slept. ate. regret." }],
  },
  [{ id: "late", prompt: "You're running 20 minutes late to meet a friend. Text them." }],
  ["My apologies, I am running behind schedule."],
);
assert.equal(cleaned.answers[0].tell, "Nothing like '…'.");
assert.equal(cleaned.verdictLine, "… unlike u");
assert.equal(cleaned.overall, 2);

// The owner's bio is public, so the judge may echo it.
assert.equal(
  redactPrivate("Not a guy allergic to capital letters.", ["allergic to capital letters fr"], [
    "chronically late, allergic to capital letters",
  ]),
  "Not a guy allergic to capital letters.",
);

console.log("redact checks passed");
