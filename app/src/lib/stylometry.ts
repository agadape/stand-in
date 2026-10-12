import type { Persona } from "./db/schema";
import type { LlmVerdict } from "./llm";
import type { Scenario } from "./scenarios";
import { features, similarity, type StyleFeatures } from "./style";

/**
 * The imitation game's judge without a model: it counts writing habits people don't know
 * they have and measures how far a candidate's are from the owner's. Same input, same
 * score, every time, so anyone holding the owner's texts can recompute a verdict, and
 * there is no daily allowance to run out of.
 *
 * Bump the version whenever a word list, weight or formula here changes: a verdict is
 * only reproducible by the version that wrote it.
 */
export const STYLOMETRY_VERSION = "stylometry-v1";

/**
 * Words that mean the same thing but that each person spells one way. Which variant you
 * reach for is one of the strongest tells there is. Indonesian chat spellings and English.
 */
const VARIANTS: Record<string, string[]> = {
  no: ["gak", "ga", "gk", "nggak", "ngga", "enggak", "engga", "tidak", "tdk", "kagak", "no", "nope", "nah"],
  me: ["gue", "gw", "gua", "aku", "saya", "ak"],
  you: ["lo", "lu", "elu", "kamu", "km", "anda", "you", "u"],
  already: ["udh", "udah", "dah", "sudah", "sdh"],
  very: ["bgt", "banget", "bngt", "sangat", "really", "rly", "very", "super"],
  yes: ["iya", "iy", "yoi", "yes", "yeah", "yea", "yep", "yup", "ok", "oke", "okay", "okey", "k", "kk"],
  thanks: ["makasih", "mksh", "makasi", "thx", "thanks", "ty", "tengkyu"],
  because: ["karena", "krn", "soalnya", "because", "bc", "cuz", "cause", "coz"],
  with: ["sama", "sm", "dengan", "dgn"],
  which: ["yang", "yg"],
  notYet: ["belum", "blm", "belom"],
  just: ["aja", "aj", "saja", "doang"],
  want: ["mau", "mo", "pengen", "pgn", "wanna", "gonna"],
  how: ["gimana", "gmn", "bagaimana"],
  people: ["bro", "bruh", "cuy", "guys", "gais", "dude", "bestie", "sis", "man"],
  your: ["your", "ur"],
  please: ["please", "pls", "plz", "tolong", "tlg"],
  dontKnow: ["idk", "dunno", "gatau", "gtw", "entah"],
};

/** Little words with no meaning of their own; how often you drop them in is a habit. */
const PARTICLES = [
  "sih", "dong", "deh", "kok", "nih", "kan", "lah", "loh", "lho", "tuh", "mah", "ya", "yaa", "anjir", "anjay", "njir",
  "fr", "ngl", "tbh", "literally", "like", "honestly", "actually", "lowkey", "omg", "wait", "bro", "lol", "idk",
];

/** Laughs are stretched at will ("wkwkwk", "hahaha"), so they are matched by family. */
const LAUGHS: [string, RegExp][] = [
  ["wkwk", /\b(?:wk){2,}w?\b|\bkwk+w*\b/i],
  ["awok", /\ba?wok(?:a?wok)+\b/i],
  ["haha", /\b(?:ha){2,}h?\b/i],
  ["hehe", /\b(?:he){2,}h?\b/i],
  ["xixi", /\b(?:xi){2,}\b/i],
  ["lol", /\blo+l+\b/i],
  ["lmao", /\blmf?a+o+\b/i],
  ["😂", /😂|🤣/u],
  ["😭", /😭/u],
  ["💀", /💀/u],
];

const EMOJI = /\p{Extended_Pictographic}/gu;
const words = (text: string): string[] => text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
/** "nahhh" and "iyaa" are "nah" and "iya" said with feeling: same spelling choice. */
const unstretched = (word: string) => word.replace(/(\p{L})\1+$/u, "$1");

type Profile = {
  habits: StyleFeatures;
  /** Per variant group: how often each spelling was used. */
  variants: Record<string, Record<string, number>>;
  /** Share of messages with each family of laugh. */
  laughs: Record<string, number>;
  /** Share of messages containing each particle. */
  particles: Record<string, number>;
  /** Share of messages with a stretched word ("bangettt", "nooo"). */
  stretch: number;
  emoji: Record<string, number>;
  trigrams: Map<string, number>;
  messages: number;
};

function profile(texts: string[]): Profile {
  const clean = texts.map((t) => t.trim()).filter(Boolean);
  const variants: Profile["variants"] = {};
  const laughs: Record<string, number> = {};
  const particles: Record<string, number> = {};
  const emoji: Record<string, number> = {};
  const trigrams = new Map<string, number>();
  let stretched = 0;

  for (const text of clean) {
    const tokens = words(text);
    for (const [group, spellings] of Object.entries(VARIANTS)) {
      for (const token of tokens.map(unstretched)) {
        if (!spellings.includes(token)) continue;
        const counts = (variants[group] ??= {});
        counts[token] = (counts[token] ?? 0) + 1;
      }
    }
    for (const [family, pattern] of LAUGHS) if (pattern.test(text)) laughs[family] = (laughs[family] ?? 0) + 1;
    for (const particle of PARTICLES) if (tokens.includes(particle)) particles[particle] = (particles[particle] ?? 0) + 1;
    for (const e of text.match(EMOJI) ?? []) emoji[e] = (emoji[e] ?? 0) + 1;
    if (/(\p{L})\1{2,}/u.test(text)) stretched++;
    // Letter texture: three-character runs, punctuation and case flattened.
    const flat = ` ${tokens.join(" ")} `;
    for (let i = 0; i + 3 <= flat.length; i++) trigrams.set(flat.slice(i, i + 3), (trigrams.get(flat.slice(i, i + 3)) ?? 0) + 1);
  }
  for (const key of Object.keys(particles)) particles[key] /= clean.length || 1;
  for (const key of Object.keys(laughs)) laughs[key] /= clean.length || 1;

  return { habits: features(clean), variants, laughs, particles, stretch: clean.length ? stretched / clean.length : 0, emoji, trigrams, messages: clean.length };
}

function cosine(a: Map<string, number> | Record<string, number>, b: Map<string, number> | Record<string, number>) {
  const A = a instanceof Map ? a : new Map(Object.entries(a));
  const B = b instanceof Map ? b : new Map(Object.entries(b));
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [key, value] of A) {
    na += value * value;
    dot += value * (B.get(key) ?? 0);
  }
  for (const value of B.values()) nb += value * value;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/**
 * Overlap of two sets of rates, 0..1 (sum of the smaller over sum of the larger). Unlike a
 * cosine it cares how much: saying "fr" in every text is not like saying it in one of ten,
 * which is exactly how an imitation overdoes it.
 */
function overlap(a: Record<string, number>, b: Record<string, number>) {
  let min = 0;
  let max = 0;
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    min += Math.min(a[key] ?? 0, b[key] ?? 0);
    max += Math.max(a[key] ?? 0, b[key] ?? 0);
  }
  return max ? min / max : 0;
}

const top = (counts: Record<string, number>) => Object.entries(counts).sort((x, y) => y[1] - x[1])[0]?.[0];

type Part = { score: number; weight: number };

/**
 * How alike two profiles are, 0..1, as a weighted mean of the parts that can be compared.
 * A part with no evidence on either side (neither wrote a "no", neither laughed) is left
 * out rather than counted as agreement.
 */
function compare(owner: Profile, candidate: Profile) {
  const parts: Record<string, Part> = {
    habits: { score: similarity(owner.habits, candidate.habits), weight: 0.4 },
    length: { score: lengthMatch(owner.habits.avgChars, candidate.habits.avgChars), weight: 0.1 },
    texture: { score: Math.min(1, cosine(owner.trigrams, candidate.trigrams) / 0.55), weight: 0.05 },
    stretch: { score: 1 - Math.min(1, Math.abs(owner.stretch - candidate.stretch) / 0.5), weight: 0.05 },
  };

  const shared = Object.keys(VARIANTS).filter((g) => owner.variants[g] && candidate.variants[g]);
  if (shared.length) {
    const mean = shared.reduce((sum, g) => sum + cosine(owner.variants[g], candidate.variants[g]), 0) / shared.length;
    parts.variants = { score: mean, weight: 0.2 };
  }
  if (Object.keys(owner.laughs).length || Object.keys(candidate.laughs).length) {
    parts.laughs = { score: overlap(owner.laughs, candidate.laughs), weight: 0.1 };
  }
  if (Object.keys(owner.particles).length || Object.keys(candidate.particles).length) {
    parts.particles = { score: overlap(owner.particles, candidate.particles), weight: 0.15 };
  }
  if (Object.keys(owner.emoji).length || Object.keys(candidate.emoji).length) {
    parts.emoji = { score: cosine(owner.emoji, candidate.emoji), weight: 0.05 };
  }

  const weight = Object.values(parts).reduce((sum, p) => sum + p.weight, 0);
  const score = Object.values(parts).reduce((sum, p) => sum + p.score * p.weight, 0) / weight;
  return { score, parts };
}

/** 1 when the average lengths match, falling as one becomes a multiple of the other. */
function lengthMatch(a: number, b: number) {
  return a && b ? Math.min(a, b) / Math.max(a, b) : 0;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * The clearest things that gave an attempt away, most damning first. For a single answer
 * pass `rates = false`: "says it a lot" means nothing when there is one text to count.
 */
function giveaways(name: string, owner: Profile, texts: string[], rates = true): string[] {
  const out: string[] = [];
  const candidate = profile(texts);
  const h = owner.habits;

  for (const [group, used] of Object.entries(candidate.variants)) {
    const theirs = owner.variants[group];
    if (!theirs) continue;
    const said = top(used)!;
    if (!(said in theirs)) out.push(`"${said}" gave it away. ${name} writes "${top(theirs)}".`);
  }
  const laughed = top(candidate.laughs);
  const ownerLaugh = top(owner.laughs);
  if (laughed && ownerLaugh && !(laughed in owner.laughs)) out.push(`Laughed "${laughed}". ${name} laughs "${ownerLaugh}".`);
  if (laughed && !ownerLaugh) out.push(`Laughed "${laughed}". ${name} doesn't laugh in text.`);

  const capitals = texts.filter((t) => /^\p{Lu}/u.test(t.trim())).length / texts.length;
  if (capitals >= 0.5 && h.lowerStart > 0.7) out.push(`Starts with a capital letter. ${name} does that in ${pct(1 - h.lowerStart)} of texts.`);
  if (capitals < 0.5 && h.lowerStart < 0.3) out.push(`Starts lowercase. ${name} capitalises ${pct(1 - h.lowerStart)} of texts.`);

  const stopped = texts.filter((t) => /[.!?]$/.test(t.trim())).length / texts.length;
  if (stopped >= 0.5 && h.endPunct < 0.3) out.push(`Ends with punctuation. ${name} only does in ${pct(h.endPunct)} of texts.`);
  if (stopped < 0.5 && h.endPunct > 0.7) out.push(`No punctuation at the end. ${name} ends ${pct(h.endPunct)} of texts with it.`);

  const length = texts.reduce((n, t) => n + t.trim().length, 0) / texts.length;
  if (length > h.avgChars * 2 + 15) out.push(`${Math.round(length)} characters long. ${name} averages ${Math.round(h.avgChars)}.`);
  if (length < h.avgChars / 2.5 - 5) out.push(`Only ${Math.round(length)} characters. ${name} averages ${Math.round(h.avgChars)}.`);

  const emojis = Object.keys(candidate.emoji);
  if (emojis.length && h.emoji < 0.1) out.push(`Used ${emojis[0]}. ${name} hardly ever uses emoji.`);
  else if (emojis.length && !emojis.some((e) => e in owner.emoji)) out.push(`Used ${emojis[0]}. ${name}'s go-to is ${top(owner.emoji)}.`);
  if (rates && !emojis.length && h.emoji > 0.6) out.push(`No emoji at all. ${name} uses one in ${pct(h.emoji)} of texts.`);

  for (const [particle, rate] of rates ? Object.entries(candidate.particles) : []) {
    if (rate >= 0.5 && (owner.particles[particle] ?? 0) < 0.1 && particle.length > 2) {
      out.push(`Says "${particle}" a lot. ${name} almost never does.`);
    }
    if (rate >= 0.66 && (owner.particles[particle] ?? 0) >= 0.1 && rate > (owner.particles[particle] ?? 0) * 3) {
      out.push(`"${particle}" in ${pct(rate)} of these. ${name} uses it in ${pct(owner.particles[particle])}: overdone.`);
    }
  }
  if (rates && candidate.stretch >= 0.5 && owner.stretch < 0.1) out.push(`Stretched a word out. ${name} doesn't.`);
  return out;
}

/** Four or more consecutive words lifted from one of the owner's real texts, or a whole text copied. */
function copied(answer: string, ownerTexts: string[]) {
  const flat = ` ${words(answer).join(" ")} `;
  return ownerTexts.some((text) => {
    const w = words(text);
    if (w.length < 2) return false;
    if (w.length < 4) return flat === ` ${w.join(" ")} `;
    for (let i = 0; i + 4 <= w.length; i++) if (flat.includes(` ${w.slice(i, i + 4).join(" ")} `)) return true;
    return false;
  });
}

/** One line from the twin, shaped like its owner types: their casing, their punctuation. */
function verdictLine(owner: Profile, score: number, challenger: boolean) {
  const line = !challenger
    ? "That is me. Now beat it."
    :
    score >= 80 ? "Ok that is uncomfortably close to me." : score >= 62 ? "Close. Too close. I'm watching you." : score >= 38 ? "Nice try. You overdid it." : "Who is this. That is not me.";
  let out = owner.habits.lowerStart > 0.6 ? line.toLowerCase() : line;
  if (owner.habits.endPunct < 0.3) out = out.replace(/[.]$/, "");
  return out;
}

export type StylometryResult = {
  llm: LlmVerdict;
  style: { persona: StyleFeatures; candidate: StyleFeatures; similarity: number; notes: string[] };
  /** 0..100, before conversion to basis points. */
  score: number;
};

/**
 * Scores an attempt. `strict` (a challenger, not the owner) also disqualifies answers
 * copied out of the owner's real texts, which a close friend may well have on their phone.
 */
export function stylometry(persona: Persona, scenarios: Scenario[], answers: string[], strict: boolean): StylometryResult {
  const ownerTexts = [...persona.samples, ...persona.quiz.map((q) => q.answer)];
  const owner = profile(ownerTexts);
  const cheats = answers.map((a) => strict && copied(a, ownerTexts));
  const honest = answers.filter((_, i) => !cheats[i]);

  const whole = honest.length ? compare(owner, profile(honest)) : { score: 0 };
  // A copied answer earns nothing and drags the rest down in proportion.
  const score = Math.round(whole.score * 1000 * (honest.length / answers.length)) / 10;

  const perAnswer = answers.map((answer, i) => {
    if (cheats[i]) return { scenarioId: scenarios[i].id, score: 0, tell: `Copied from ${persona.name}'s real texts. That doesn't count.` };
    const one = compare(owner, profile([answer]));
    const tells = giveaways(persona.name, owner, [answer], false);
    return {
      scenarioId: scenarios[i].id,
      score: Math.round(one.score * 100),
      tell: !strict ? "Yours. This is part of the bar." : tells[0] ?? (one.score > 0.6 ? `Nothing here gives it away. That is ${persona.name}'s shape.` : `No single slip, but the rhythm isn't ${persona.name}'s.`),
    };
  });

  const candidateHabits = features(answers);
  return {
    llm: { answers: perAnswer, overall: Math.round(score), verdictLine: verdictLine(owner, score, strict) },
    style: {
      persona: owner.habits,
      candidate: candidateHabits,
      similarity: Math.round(whole.score * 1000) / 1000,
      // The owner is the standard, not a suspect: no list of slips for them.
      notes: strict ? giveaways(persona.name, owner, honest.length ? honest : answers).slice(0, 4) : [],
    },
    score,
  };
}
