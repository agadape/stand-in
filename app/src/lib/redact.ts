import type { Persona } from "./db/schema";
import type { LlmVerdict } from "./llm";
import type { Scenario } from "./scenarios";

// This many consecutive words copied from a private text count as showing it.
const RUN = 3;
const REDACTED = "…";

type Token = { word: string; start: number; end: number };

/** Words with their positions; case and apostrophes ignored so "What's" matches "whats". */
function tokens(text: string): Token[] {
  return [...text.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)].map((m) => ({
    word: m[0].toLowerCase().replace(/['’]/g, ""),
    start: m.index,
    end: m.index + m[0].length,
  }));
}

function runs(words: string[], size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i + size <= words.length; i++) out.push(words.slice(i, i + size).join(" "));
  return out;
}

/**
 * Removes the owner's private words from text that will be shown publicly.
 *
 * Flags any three consecutive words taken from a private text, and a whole two-word
 * private text. Single words are not flagged: "omw" is a word, not a secret. Runs that
 * also occur in publicTexts (the candidate's own answer, the scenario, the owner's public
 * bio) stay, since quoting those reveals nothing.
 */
export function redactPrivate(text: string, privateTexts: string[], publicTexts: string[]): string {
  const privateWords = privateTexts.map((t) => tokens(t).map((k) => k.word));
  const publicWords = publicTexts.map((t) => tokens(t).map((k) => k.word));
  const secret = new Set([
    ...privateWords.flatMap((w) => runs(w, RUN)),
    ...privateWords.filter((w) => w.length === 2).map((w) => w.join(" ")),
  ]);
  for (const words of publicWords) {
    for (const run of [...runs(words, RUN), ...runs(words, 2)]) secret.delete(run);
  }
  if (secret.size === 0) return text;

  const found = tokens(text);
  const words = found.map((k) => k.word);
  const hit = new Array<boolean>(found.length).fill(false);
  for (const size of [RUN, 2]) {
    runs(words, size).forEach((run, i) => {
      if (secret.has(run)) hit.fill(true, i, i + size);
    });
  }
  if (!hit.includes(true)) return text;

  // Each stretch of flagged words, with the punctuation inside and right after it, becomes one ellipsis.
  let out = "";
  let cursor = 0;
  for (let i = 0; i < found.length; i++) {
    if (!hit[i]) continue;
    let last = i;
    while (hit[last + 1]) last++;
    out += text.slice(cursor, found[i].start) + REDACTED;
    cursor = found[last].end + (text.slice(found[last].end).match(/^[.,!?]+/)?.[0].length ?? 0);
    i = last;
  }
  return out + text.slice(cursor);
}

/**
 * The verdict as it may be shown and hashed. The judge is told never to quote the persona
 * and mostly obeys; this makes it hold for the tells and the verdict line whatever the
 * model does.
 */
export function withoutPrivateText(
  llm: LlmVerdict,
  persona: Persona,
  scenarios: Scenario[],
  answers: string[],
): LlmVerdict {
  const privateTexts = [...persona.samples, ...persona.quiz.map((q) => q.answer)];
  const publicTexts = [
    ...answers,
    ...scenarios.map((s) => s.prompt),
    ...persona.quiz.map((q) => q.question),
    persona.name,
    persona.bio,
  ];
  return {
    ...llm,
    answers: llm.answers.map((a) => ({ ...a, tell: redactPrivate(a.tell, privateTexts, publicTexts) })),
    verdictLine: redactPrivate(llm.verdictLine, privateTexts, publicTexts),
  };
}
