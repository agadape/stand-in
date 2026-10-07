import { keccak256, stringToHex, type Hex } from "viem";
import type { Persona } from "./db/schema";
import { runJudge, type LlmVerdict } from "./llm";
import type { Scenario } from "./scenarios";
import { features, notes, similarity, type StyleFeatures } from "./style";

export type { LlmVerdict } from "./llm";

export type Verdict = {
  llm: LlmVerdict;
  style: { persona: StyleFeatures; candidate: StyleFeatures; similarity: number; notes: string[] };
  scoreBps: number;
  verdictHash: Hex;
};

const LLM_WEIGHT = 0.65;
const STYLE_WEIGHT = 0.35;

const RULES = `You are someone's AI twin, acting as the judge in a party game called Stand-In.
A candidate claims to be the person you imitate (call them NAME; the persona block gives the real name) and has answered a few texting scenarios as them. Decide how much each answer sounds like NAME.

Score each answer 0-100 for how plausibly NAME typed it: voice, rhythm, casing and punctuation habits, vocabulary and slang, humour, length, and what NAME would actually choose to say or not say. Agreeing on a topic is weak evidence; sounding like them is strong evidence.
Penalise answers that read polished, generic or assistant-like. Also penalise answers that overdo NAME's tics; imitators exaggerate.
For each answer write one short, specific "tell": the detail that sold it or gave it away, quoting a word or two from the candidate's answer. Never quote or paraphrase NAME's private sample messages in a tell; describe the habit instead.
"overall" is your holistic 0-100 confidence that this is NAME, not an average.
"verdictLine" is one playful sentence, under 20 words, written the way NAME texts, addressed to the candidate.
Scenario ids in "answers" must match the ids given, in the same order.
Respond with JSON only.`;

function personaBlock(persona: Persona) {
  const quiz = persona.quiz.map((q) => `Q: ${q.question}\nA: ${q.answer}`).join("\n");
  const samples = persona.samples.map((s) => `- ${s}`).join("\n");
  return `NAME is ${persona.name}.${persona.bio ? ` About them, in their words: ${persona.bio}` : ""}

How ${persona.name} answered their own quiz:
${quiz}

Real messages ${persona.name} has sent:
${samples}`;
}

function candidateBlock(scenarios: Scenario[], answers: string[]) {
  return scenarios
    .map((s, i) => `Scenario id: ${s.id}\nScenario: ${s.prompt}\nCandidate's answer: ${answers[i]}`)
    .join("\n\n");
}

export async function judge(persona: Persona, scenarios: Scenario[], answers: string[]): Promise<Verdict> {
  const llm = await runJudge({
    rules: RULES,
    persona: personaBlock(persona),
    candidate: candidateBlock(scenarios, answers),
  });

  const personaStyle = features([...persona.samples, ...persona.quiz.map((q) => q.answer)]);
  const candidateStyle = features(answers);
  const sim = similarity(personaStyle, candidateStyle);
  const style = {
    persona: personaStyle,
    candidate: candidateStyle,
    similarity: sim,
    notes: notes(persona.name, personaStyle, candidateStyle),
  };

  const score = LLM_WEIGHT * llm.overall + STYLE_WEIGHT * sim * 100;
  const scoreBps = Math.max(0, Math.min(10_000, Math.round(score * 100)));

  // Anyone holding the stored verdict can recompute this and check it against the chain.
  // Field set and order are mirrored in components/verify-verdict.tsx.
  const verdictHash = keccak256(
    stringToHex(
      JSON.stringify({
        scenarios: scenarios.map((s) => s.id),
        answers,
        llm,
        similarity: sim,
        scoreBps,
      }),
    ),
  );

  return { llm, style, scoreBps, verdictHash };
}
