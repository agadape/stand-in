/**
 * Countable texting habits. These give the verdict evidence a player can argue with
 * ("you capitalise, Dave never does") and keep the score from resting on the LLM alone.
 */
export type StyleFeatures = {
  lowerStart: number; // messages that start lowercase
  avgChars: number; // mean message length in characters
  emoji: number; // messages containing an emoji
  endPunct: number; // messages ending in . ! or ?
  exclaim: number; // messages with !
  laugh: number; // lol / lmao / haha / 😂 etc.
  ellipsis: number; // ... or …
  question: number; // messages with ?
  lowerI: number; // standalone "i" instead of "I"
  abbrev: number; // u, ur, rn, idk, tbh, ngl, omg, wya, brb, imo, smh, btw
};

const EMOJI = /\p{Extended_Pictographic}/u;
const LAUGH = /\b(lol+|lmao+|lmfao|haha+|hehe+|rofl|dead|😂|🤣|💀)\b|😂|🤣|💀/i;
const ABBREV = /\b(u|ur|rn|idk|tbh|ngl|omg|wya|brb|imo|smh|btw|pls|plz|thx|ty|k|kk|wtf|af|fr|ikr|nvm|ofc)\b/i;
const LOWER_I = /(^|[^a-zA-Z'])i([^a-zA-Z']|$)/;

function rate(texts: string[], test: (t: string) => boolean) {
  if (!texts.length) return 0;
  return texts.filter(test).length / texts.length;
}

export function features(texts: string[]): StyleFeatures {
  const clean = texts.map((t) => t.trim()).filter(Boolean);
  const avgChars = clean.length ? clean.reduce((n, t) => n + t.length, 0) / clean.length : 0;
  return {
    lowerStart: rate(clean, (t) => /^[a-z]/.test(t)),
    avgChars,
    emoji: rate(clean, (t) => EMOJI.test(t)),
    endPunct: rate(clean, (t) => /[.!?]$/.test(t)),
    exclaim: rate(clean, (t) => t.includes("!")),
    laugh: rate(clean, (t) => LAUGH.test(t)),
    ellipsis: rate(clean, (t) => /\.{3}|…/.test(t)),
    question: rate(clean, (t) => t.includes("?")),
    lowerI: rate(clean, (t) => LOWER_I.test(t)),
    abbrev: rate(clean, (t) => ABBREV.test(t)),
  };
}

const WEIGHTS: Record<keyof StyleFeatures, number> = {
  lowerStart: 2,
  avgChars: 1.5,
  emoji: 1.5,
  endPunct: 1.5,
  exclaim: 1,
  laugh: 1,
  ellipsis: 0.5,
  question: 0.5,
  lowerI: 1.5,
  abbrev: 1.5,
};

function normalised(f: StyleFeatures): Record<keyof StyleFeatures, number> {
  return { ...f, avgChars: Math.min(f.avgChars / 160, 1) };
}

/** 0..1, where 1 means the candidate's habits match the persona's exactly. */
export function similarity(persona: StyleFeatures, candidate: StyleFeatures): number {
  const a = normalised(persona);
  const b = normalised(candidate);
  let total = 0;
  let weight = 0;
  for (const key of Object.keys(WEIGHTS) as (keyof StyleFeatures)[]) {
    total += WEIGHTS[key] * Math.abs(a[key] - b[key]);
    weight += WEIGHTS[key];
  }
  return Math.max(0, 1 - total / weight);
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Plain-language comparisons for the evidence panel; only the habits that differ clearly. */
export function notes(name: string, persona: StyleFeatures, candidate: StyleFeatures): string[] {
  const out: string[] = [];
  const diff = (key: keyof StyleFeatures) => Math.abs(persona[key] - candidate[key]);

  if (diff("lowerStart") > 0.3) {
    out.push(`${name} starts ${pct(persona.lowerStart)} of texts lowercase. You: ${pct(candidate.lowerStart)}.`);
  }
  if (Math.abs(persona.avgChars - candidate.avgChars) > 40) {
    out.push(
      `${name} averages ${Math.round(persona.avgChars)} characters a text. You: ${Math.round(candidate.avgChars)}.`,
    );
  }
  if (diff("emoji") > 0.3) out.push(`Emoji in ${pct(persona.emoji)} of ${name}'s texts. You: ${pct(candidate.emoji)}.`);
  if (diff("endPunct") > 0.3) {
    out.push(`${name} ends ${pct(persona.endPunct)} of texts with punctuation. You: ${pct(candidate.endPunct)}.`);
  }
  if (diff("laugh") > 0.3) out.push(`${name} laughs in text ${pct(persona.laugh)} of the time. You: ${pct(candidate.laugh)}.`);
  if (diff("lowerI") > 0.3) {
    out.push(candidate.lowerI > persona.lowerI ? `${name} capitalises "I". You didn't.` : `${name} writes "i". You capitalised it.`);
  }
  if (diff("abbrev") > 0.3) out.push(`Abbreviations (u, rn, idk) in ${pct(persona.abbrev)} of ${name}'s texts. You: ${pct(candidate.abbrev)}.`);
  if (diff("exclaim") > 0.3) out.push(`Exclamation marks: ${name} ${pct(persona.exclaim)}, you ${pct(candidate.exclaim)}.`);

  return out.slice(0, 4);
}
