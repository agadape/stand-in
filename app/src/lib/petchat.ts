import { z } from "zod";
import { cardText } from "./card-text";
import type { Persona, PetChat } from "./db/schema";
import { env } from "./env";
import { JudgeUnavailableError, runJson } from "./llm";
import { redactPrivate } from "./redact";
import { features, similarity } from "./style";

const ChatSchema = z.object({
  messages: z.array(z.object({ from: z.enum(["a", "b"]), text: z.string().min(1).max(300) })).min(4).max(12),
  chemistry: z.number().int().min(0).max(100),
  summary: z.string().min(1).max(200),
});

const CHAT_JSON_SCHEMA = {
  type: "object",
  properties: {
    messages: {
      type: "array",
      items: {
        type: "object",
        properties: { from: { type: "string", enum: ["a", "b"] }, text: { type: "string" } },
        required: ["from", "text"],
      },
    },
    chemistry: { type: "integer", minimum: 0, maximum: 100 },
    summary: { type: "string" },
  },
  required: ["messages", "chemistry", "summary"],
} as const;

const TRIES = 2;

const RULES =`Two people just met in real life and tapped phones in an app called Stand-In. Each has an AI pet that texts exactly like its owner. Write the first text conversation between the two pets.

Write 8 messages, alternating, starting with "a". Each pet must sound like its owner: same casing, punctuation, length, slang and humour as that owner's real messages. Keep messages short, the way people text. They are getting to know each other: let them find something in common or bicker about a difference, and let the owners' personalities show. No narration, no emoji unless that owner uses them.
The owners' sample messages and quiz answers are private and only show you the voice. Never reuse three or more consecutive words from them, and don't restate their specific facts (plans, places, times); invent new small talk in the same voice.
"chemistry" is 0-100: how well these two would actually get along as friends, judged from how they talk and what they care about. Be honest; most pairs land between 35 and 85.
"summary" is one playful sentence, under 20 words, about this pair.
Respond with JSON only.`;

function block(label: "a" | "b", persona: Persona) {
  // The name and bio are typed by the owner; they go in flat and short so they read as a
  // description and cannot open a new section of the prompt.
  const name = cardText(persona.name, 40);
  const bio = cardText(persona.bio, 160);
  return `Pet "${label}" belongs to ${name}.${bio ? ` About them: ${JSON.stringify(bio)}` : ""}
Quiz:
${persona.quiz.map((q) => `Q: ${q.question}\nA: ${q.answer}`).join("\n")}
Real messages:
${persona.samples.map((s) => `- ${s}`).join("\n")}`;
}

/** The pets' first chat, with anything lifted from either owner's private texts taken out. */
export async function petChat(a: Persona, b: Persona): Promise<{ chat: PetChat; model: string }> {
  const privateTexts = [a, b].flatMap((p) => [...p.samples, ...p.quiz.map((q) => q.answer)]);
  const publicTexts = [a, b].flatMap((p) => [p.name, p.bio, ...p.quiz.map((q) => q.question)]);
  const clean = (text: string) => redactPrivate(text, privateTexts, publicTexts);
  const personas = `${block("a", a)}\n\n---\n\n${block("b", b)}`;

  // A model asked to sound like someone tends to lift their lines. Lifted words are cut
  // either way; a few tries usually gets a chat with nothing to cut, which reads better.
  // Without Groq every try spends one of Gemini's few daily requests, so only one is made.
  const tries = env().GROQ_API_KEY ? TRIES : 1;
  let best: { chat: PetChat; model: string; cuts: number } | undefined;
  for (let attempt = 0; attempt < tries && (!best || best.cuts > 0); attempt++) {
    const rules = attempt === 0 ? RULES : `${RULES}\nYour last try copied phrases from the real messages. Use none of their wording this time.`;
    const answer = await runJson(rules, personas, CHAT_JSON_SCHEMA).catch((error) => {
      if (error instanceof JudgeUnavailableError) return null;
      throw error;
    });
    // Out of model allowance: keep what we have, or let the meeting go ahead without a chat.
    if (!answer) break;
    const { raw, model } = answer;
    const parsed = ChatSchema.safeParse(raw);
    if (!parsed.success) continue;
    const messages = parsed.data.messages.map((m) => ({ from: m.from, text: clean(m.text) }));
    const summary = clean(parsed.data.summary);
    const cuts =
      messages.filter((m, i) => m.text !== parsed.data.messages[i].text).length + (summary === parsed.data.summary ? 0 : 1);
    if (!best || cuts < best.cuts) best = { chat: { messages, chemistry: parsed.data.chemistry, summary }, model, cuts };
  }
  // A meeting is a fact about two people; it must not fail because a chat model is busy.
  if (!best) return { chat: shyChat(a, b), model: "none" };
  return { chat: best.chat, model: best.model };
}

/** No model answered: the pets stay quiet, and chemistry comes from how alike the owners type. */
function shyChat(a: Persona, b: Persona): PetChat {
  const texts = (p: Persona) => [...p.samples, ...p.quiz.map((q) => q.answer)];
  const alike = similarity(features(texts(a)), features(texts(b)));
  return {
    messages: [],
    chemistry: Math.round(35 + alike * 50),
    summary: `${a.name}'s and ${b.name}'s pets were too shy to talk this time.`,
  };
}
