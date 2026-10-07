import { GoogleGenAI } from "@google/genai";
import { env } from "../env";
import { JudgeUnavailableError, LLM_VERDICT_JSON_SCHEMA, type JudgePrompt } from "./types";

/**
 * Gemini as the judge, through the Interactions API with a JSON response schema.
 * Flash models are on Google's free tier (a handful of requests per minute), which is
 * what the hosted demo runs on.
 */
export async function runGemini(prompt: JudgePrompt): Promise<unknown> {
  const client = new GoogleGenAI({ apiKey: env().GEMINI_API_KEY });
  try {
    const interaction = await client.interactions.create({
      model: env().GEMINI_MODEL,
      input: `${prompt.rules}\n\n---\n\n${prompt.persona}\n\n---\n\n${prompt.candidate}`,
      response_format: { type: "text", mime_type: "application/json", schema: LLM_VERDICT_JSON_SCHEMA },
    });
    const text = interaction.output_text;
    if (!text) throw new Error("Judge returned no text");
    return JSON.parse(text);
  } catch (error) {
    if (isRateLimit(error)) {
      throw new JudgeUnavailableError("The judge is busy (free-tier rate limit). Try again in a minute.");
    }
    throw error;
  }
}

function isRateLimit(error: unknown) {
  const status = (error as { status?: number; code?: number })?.status ?? (error as { code?: number })?.code;
  if (status === 429) return true;
  const text = error instanceof Error ? error.message : String(error);
  return /\b429\b|RESOURCE_EXHAUSTED|rate limit|quota/i.test(text);
}
