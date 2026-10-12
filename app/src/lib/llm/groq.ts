import { env } from "../env";
import { JudgeUnavailableError, LLM_VERDICT_JSON_SCHEMA, type JudgePrompt, type JudgeResult } from "./types";

const URL = "https://api.groq.com/openai/v1/chat/completions";
const PER_CALL_TIMEOUT_MS = 25_000;

/**
 * An open model hosted by Groq as the judge, through its OpenAI-compatible API (plain
 * fetch, no SDK). Fast (about a second) and generous on the free tier, but as measured
 * on 12 Oct none of its models can tell an imitation from the owner, so it is for local
 * development without a Gemini key, not for the hosted game.
 *
 * GROQ_MODEL is an ordered list, like GEMINI_MODEL: the next model is tried when one is
 * rate-limited, overloaded or slow. JSON mode plus the schema in the prompt works on
 * every chat model there; runJudge validates the shape afterwards.
 */
export function runGroq(prompt: JudgePrompt): Promise<JudgeResult> {
  return groqJson(prompt.rules, `${prompt.persona}\n\n---\n\n${prompt.candidate}`, LLM_VERDICT_JSON_SCHEMA);
}

/** One JSON answer from the Groq chain: `system` sets the task, `schema` the shape. */
export async function groqJson(system: string, user: string, schema: object, temperature = 0.3): Promise<JudgeResult> {
  const e = env();
  const models = e.GROQ_MODEL.split(",").map((m) => m.trim()).filter(Boolean);
  system = `${system}\n\nYour JSON must match this schema:\n${JSON.stringify(schema)}`;
  const skipped: string[] = [];

  for (const model of models) {
    try {
      const res = await fetch(URL, {
        method: "POST",
        headers: { authorization: `Bearer ${e.GROQ_API_KEY}`, "content-type": "application/json" },
        signal: AbortSignal.timeout(PER_CALL_TIMEOUT_MS),
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: { type: "json_object" },
          temperature,
          // Only the gpt-oss models take a reasoning effort.
          ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: e.GROQ_REASONING } : {}),
        }),
      });
      if (!res.ok) {
        const text = (await res.text()).slice(0, 200);
        if (res.status === 429 || res.status >= 500) {
          skipped.push(`${model} (${res.status}: ${text})`);
          continue;
        }
        throw new Error(`Groq ${model} -> ${res.status}: ${text}`);
      }
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = json.choices?.[0]?.message?.content ?? "";
      // Tolerate a model that wraps its JSON in thoughts or a code fence.
      const body = content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1);
      if (!body) throw new Error(`${model} returned no JSON`);
      if (skipped.length) console.warn(`[judge] used ${model} after: ${skipped.join("; ")}`);
      return { raw: JSON.parse(body), model };
    } catch (error) {
      if (!(error instanceof Error) || !/timeout|abort|fetch failed/i.test(`${error.name} ${error.message}`)) throw error;
      skipped.push(`${model} (${error.name})`);
    }
  }

  console.warn(`[judge] all Groq models unavailable: ${skipped.join("; ")}`);
  throw new JudgeUnavailableError("The judge is busy right now. Try again in a minute.");
}
