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
  /** Share of messages that say "I" at all, in either case (i, I, i'm, im, ive). */
  firstPerson: number;
  /** Of the messages that say "I", the share that write it lowercase. 0 when none do. */
  lowerI: number;
  abbrev: number; // u, ur, rn, idk, tbh, ngl, omg, wya, brb, imo, smh, btw
};

const EMOJI = /\p{Extended_Pictographic}/u;
const LAUGH = /\b(lol+|lmao+|lmfao|haha+|hehe+|rofl|dead|😂|🤣|💀)\b|😂|🤣|💀/i;
const ABBREV = /\b(u|ur|rn|idk|tbh|ngl|omg|wya|brb|imo|smh|btw|pls|plz|thx|ty|k|kk|wtf|af|fr|ikr|nvm|ofc)\b/i;
// "I" as a word, with or without a contraction, plus the apostrophe-less "im" / "ive".
const FIRST_PERSON = /(?:^|[^a-zA-Z])(i|I)(?:m|ve)?(?=$|[^a-zA-Z])/;
const FIRST_PERSON_LOWER = /(?:^|[^a-zA-Z])i(?:m|ve)?(?=$|[^a-zA-Z])/;

function rate(texts: string[], test: (t: string) => boolean) {
  if (!texts.length) return 0;
  return texts.filter(test).length / texts.length;
}

export function features(texts: string[]): StyleFeatures {
  const clean = texts.map((t) => t.trim()).filter(Boolean);
  const avgChars = clean.length ? clean.reduce((n, t) => n + t.length, 0) / clean.length : 0;
  const sayingI = clean.filter((t) => FIRST_PERSON.test(t));
  return {
    lowerStart: rate(clean, (t) => /^[a-z]/.test(t)),
    avgChars,
    emoji: rate(clean, (t) => EMOJI.test(t)),
    endPunct: rate(clean, (t) => /[.!?]$/.test(t)),
    exclaim: rate(clean, (t) => t.includes("!")),
    laugh: rate(clean, (t) => LAUGH.test(t)),
    ellipsis: rate(clean, (t) => /\.{3}|…/.test(t)),
    question: rate(clean, (t) => t.includes("?")),
    firstPerson: clean.length ? sayingI.length / clean.length : 0,
    lowerI: rate(sayingI, (t) => FIRST_PERSON_LOWER.test(t)),
    abbrev: rate(clean, (t) => ABBREV.test(t)),
  };
}

type Scored = Exclude<keyof StyleFeatures, "firstPerson">;

const WEIGHTS: Record<Scored, number> = {
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

function normalised(f: StyleFeatures): Record<Scored, number> {
  return { ...f, avgChars: Math.min(f.avgChars / 160, 1) };
}

/** How someone writes "I" is only evidence when both sides actually wrote it. */
function bothSayI(persona: StyleFeatures, candidate: StyleFeatures) {
  return persona.firstPerson > 0 && candidate.firstPerson > 0;
}

/**
 * A weighted mean habit difference of this much or more counts as "nothing alike".
 * Without it the score has a high floor: most habits are absent on both sides (no emoji,
 * no ellipsis, no "!"), which reads as agreement, so an email-style reply measured 65%
 * similar to a lowercase one-word texter. First-pass value; tune from playtest data.
 */
const SATURATION = 0.4;

/** 0..1, where 1 means the candidate's habits match the persona's exactly. */
export function similarity(persona: StyleFeatures, candidate: StyleFeatures): number {
  const a = normalised(persona);
  const b = normalised(candidate);
  let total = 0;
  let weight = 0;
  for (const key of Object.keys(WEIGHTS) as Scored[]) {
    if (key === "lowerI" && !bothSayI(persona, candidate)) continue;
    total += WEIGHTS[key] * Math.abs(a[key] - b[key]);
    weight += WEIGHTS[key];
  }
  return Math.max(0, 1 - total / weight / SATURATION);
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * Plain-language comparisons for the evidence panel; only the habits that differ clearly.
 * `who` labels the candidate: "You" for the player's own screen, a name on public pages.
 */
export function notes(name: string, persona: StyleFeatures, candidate: StyleFeatures, who = "You"): string[] {
  const out: string[] = [];
  const diff = (key: Scored) => Math.abs(persona[key] - candidate[key]);

  if (diff("lowerStart") > 0.3) {
    out.push(`${name} starts ${pct(persona.lowerStart)} of texts lowercase. ${who}: ${pct(candidate.lowerStart)}.`);
  }
  if (Math.abs(persona.avgChars - candidate.avgChars) > 40) {
    out.push(
      `${name} averages ${Math.round(persona.avgChars)} characters a text. ${who}: ${Math.round(candidate.avgChars)}.`,
    );
  }
  if (diff("emoji") > 0.3) out.push(`Emoji in ${pct(persona.emoji)} of ${name}'s texts. ${who}: ${pct(candidate.emoji)}.`);
  if (diff("endPunct") > 0.3) {
    out.push(`${name} ends ${pct(persona.endPunct)} of texts with punctuation. ${who}: ${pct(candidate.endPunct)}.`);
  }
  if (diff("laugh") > 0.3) out.push(`${name} laughs in text ${pct(persona.laugh)} of the time. ${who}: ${pct(candidate.laugh)}.`);
  if (bothSayI(persona, candidate) && diff("lowerI") > 0.5) {
    out.push(
      candidate.lowerI > persona.lowerI
        ? `${name} capitalises "I". ${who}: lowercase "i".`
        : `${name} writes "i" lowercase. ${who}: capital "I".`,
    );
  }
  if (diff("abbrev") > 0.3) {
    out.push(`Abbreviations (u, rn, idk) in ${pct(persona.abbrev)} of ${name}'s texts. ${who}: ${pct(candidate.abbrev)}.`);
  }
  if (diff("exclaim") > 0.3) {
    out.push(`Exclamation marks in ${pct(persona.exclaim)} of ${name}'s texts. ${who}: ${pct(candidate.exclaim)}.`);
  }

  return out.slice(0, 4);
}
