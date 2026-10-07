import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { env } from "../env";
import { JudgeUnavailableError, LlmVerdictSchema, type JudgePrompt } from "./types";

/** Claude as the judge. Uses ANTHROPIC_API_KEY from the environment. */
export async function runAnthropic(prompt: JudgePrompt): Promise<unknown> {
  const client = new Anthropic();
  try {
    const response = await client.messages.parse({
      model: env().ANTHROPIC_MODEL,
      max_tokens: 8000,
      system: [
        { type: "text", text: prompt.rules },
        // Stable per twin, so repeated attempts against the same twin hit the cache.
        { type: "text", text: prompt.persona, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: prompt.candidate }],
      output_config: { format: zodOutputFormat(LlmVerdictSchema), effort: "medium" },
    });

    if (response.stop_reason === "refusal") {
      throw new Error(`Judge declined: ${response.stop_details?.explanation ?? "no explanation"}`);
    }
    if (!response.parsed_output) throw new Error("Judge returned no parsable verdict");
    return response.parsed_output;
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      throw new JudgeUnavailableError("The judge is busy right now. Try again in a minute.");
    }
    throw error;
  }
}
