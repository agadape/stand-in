import { GoogleGenAI } from "@google/genai";
import { env } from "../env";
import { JudgeUnavailableError, LLM_VERDICT_JSON_SCHEMA, type JudgePrompt, type JudgeResult } from "./types";

const PER_CALL_TIMEOUT_MS = 25_000;
// Stop trying further models once this much time has gone; the player is waiting.
const TOTAL_BUDGET_MS = 50_000;

/**
 * Gemini as the judge, through the Interactions API with a JSON response schema.
 *
 * Flash models are on Google's free tier, which is what the hosted demo runs on, and
 * on that tier "model is experiencing high demand" (503) is routine. So GEMINI_MODEL is
 * an ordered list: each model gets one attempt with no SDK retries, and an overload,
 * rate limit or timeout moves on to the next. Anything else is a real error.
 */
export async function runGemini(prompt: JudgePrompt): Promise<JudgeResult> {
  const e = env();
  const models = e.GEMINI_MODEL.split(",").map((m) => m.trim()).filter(Boolean);
  const client = new GoogleGenAI({ apiKey: e.GEMINI_API_KEY });
  const input = `${prompt.rules}\n\n---\n\n${prompt.persona}\n\n---\n\n${prompt.candidate}`;
  const started = Date.now();
  const skipped: string[] = [];

  for (const model of models) {
    if (Date.now() - started > TOTAL_BUDGET_MS) break;
    try {
      const interaction = await client.interactions.create(
        {
          model,
          input,
          generation_config: { thinking_level: e.GEMINI_THINKING },
          response_format: { type: "text", mime_type: "application/json", schema: LLM_VERDICT_JSON_SCHEMA },
        },
        { maxRetries: 0, timeout: PER_CALL_TIMEOUT_MS },
      );
      const text = interaction.output_text;
      if (!text) throw new Error(`${model} returned no text`);
      if (skipped.length) console.warn(`[judge] used ${model} after: ${skipped.join("; ")}`);
      return { raw: JSON.parse(text), model };
    } catch (error) {
      if (!isTransient(error)) throw error;
      skipped.push(`${model} (${describe(error)})`);
    }
  }

  console.warn(`[judge] all Gemini models unavailable: ${skipped.join("; ")}`);
  throw new JudgeUnavailableError("The judge is swamped right now (free-tier model overload). Try again in a minute.");
}

function statusOf(error: unknown): number | undefined {
  const e = error as { status?: number; statusCode?: number };
  return e?.status ?? e?.statusCode;
}

function describe(error: unknown) {
  const status = statusOf(error);
  const message = error instanceof Error ? error.message : String(error);
  return `${status ?? "error"}: ${message.slice(0, 80)}`;
}

/** Overload, rate limit, quota or timeout: worth trying another model. */
function isTransient(error: unknown) {
  const status = statusOf(error);
  if (status === 429 || status === 500 || status === 503 || status === 504) return true;
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /RESOURCE_EXHAUSTED|rate limit|quota|high demand|overloaded|unavailable|timed? ?out|abort/i.test(text);
}
