import { GoogleGenAI } from "@google/genai";
import { env } from "../env";
import { JudgeUnavailableError, LLM_VERDICT_JSON_SCHEMA, type JudgePrompt, type JudgeResult } from "./types";

const PER_CALL_TIMEOUT_MS = 25_000;
// Stop trying once this much time has gone; the player is waiting.
const TOTAL_BUDGET_MS = 50_000;
// Pause before each pass over the chain. Overloads are short spikes, so when every
// model was busy a second and third pass a few seconds later usually gets through.
const ROUND_DELAYS_MS = [0, 3_000, 6_000];

/**
 * Gemini as the judge, through the Interactions API with a JSON response schema.
 *
 * Flash models are on Google's free tier, which is what the hosted demo runs on, and
 * on that tier "model is experiencing high demand" (503) is routine. GEMINI_MODEL is an
 * ordered list of models that judge alike (see app/scripts/judge-compare.ts): each gets
 * one attempt per pass with no SDK retries, so a busy model costs a second or two before
 * the next one answers. A model that reports a quota error is dropped for the rest of
 * the request, since waiting cannot help. Anything that is not overload, quota or
 * timeout is a real error and is thrown.
 */
export async function runGemini(prompt: JudgePrompt): Promise<JudgeResult> {
  const e = env();
  const models = e.GEMINI_MODEL.split(",").map((m) => m.trim()).filter(Boolean);
  const client = new GoogleGenAI({ apiKey: e.GEMINI_API_KEY });
  const input = `${prompt.rules}\n\n---\n\n${prompt.persona}\n\n---\n\n${prompt.candidate}`;
  const started = Date.now();
  const skipped: string[] = [];
  // Model -> seconds until it says it will answer again (Infinity when it does not say).
  const outOfQuota = new Map<string, number>();
  const outOfTime = () => Date.now() - started > TOTAL_BUDGET_MS;

  for (const delay of ROUND_DELAYS_MS) {
    if (outOfQuota.size === models.length || outOfTime()) break;
    if (delay) await sleep(delay);
    for (const model of models) {
      if (outOfQuota.has(model) || outOfTime()) continue;
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
        if (isQuota(error)) outOfQuota.set(model, retryAfterSeconds(error) ?? Infinity);
      }
    }
  }

  console.warn(`[judge] all Gemini models unavailable: ${skipped.join("; ")}`);
  if (outOfQuota.size === models.length) {
    // Free-tier allowances are per day and small, so "try again in a minute" would be a lie.
    const wait = Math.min(...outOfQuota.values());
    throw new JudgeUnavailableError(
      `The judge has used up its free requests for now.${Number.isFinite(wait) ? ` It's back in about ${roughly(wait)}.` : " Try again later."}`,
    );
  }
  throw new JudgeUnavailableError("The judge is swamped right now (free-tier model overload). Try again in a minute.");
}

/** "Please retry in 17h28m35s" -> seconds, when the error says. */
function retryAfterSeconds(error: unknown): number | undefined {
  const m = /retry in (?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?/i.exec(textOf(error));
  if (!m || (!m[1] && !m[2] && !m[3])) return undefined;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

function roughly(seconds: number) {
  if (seconds < 90) return "a minute";
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
  const hours = Math.round(seconds / 3600);
  return hours === 1 ? "an hour" : `${hours} hours`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function statusOf(error: unknown): number | undefined {
  const e = error as { status?: number; statusCode?: number };
  return e?.status ?? e?.statusCode;
}

function textOf(error: unknown) {
  return error instanceof Error ? `${error.name} ${error.message}` : String(error);
}

function describe(error: unknown) {
  // Long enough to keep the limit a 429 names ("20 requests per day on Free Tier").
  return `${statusOf(error) ?? "error"}: ${textOf(error).slice(0, 160)}`;
}

/** A daily or per-minute allowance is used up; the same model will keep refusing. */
function isQuota(error: unknown) {
  return statusOf(error) === 429 || /RESOURCE_EXHAUSTED|quota|rate limit/i.test(textOf(error));
}

/** Overload, quota or timeout: worth another try, on this model or the next. */
function isTransient(error: unknown) {
  const status = statusOf(error);
  if (status === 500 || status === 503 || status === 504) return true;
  return isQuota(error) || /high demand|overloaded|unavailable|timed? ?out|abort/i.test(textOf(error));
}
