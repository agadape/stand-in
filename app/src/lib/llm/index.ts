import { env } from "../env";
import { runAnthropic } from "./anthropic";
import { runGemini } from "./gemini";
import { JudgeUnavailableError, LlmVerdictSchema, type JudgePrompt, type LlmVerdict } from "./types";

export { JudgeUnavailableError, LlmVerdictSchema } from "./types";
export type { JudgePrompt, LlmVerdict } from "./types";

export type Provider = "anthropic" | "gemini";

/**
 * Which model judges. Explicit LLM_PROVIDER wins; otherwise whichever key is present,
 * Anthropic first. The two are interchangeable: same prompt parts, same output schema.
 */
export function judgeProvider(): Provider {
  const e = env();
  if (e.LLM_PROVIDER !== "auto") return e.LLM_PROVIDER;
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (e.GEMINI_API_KEY) return "gemini";
  throw new JudgeUnavailableError(
    "No judge configured. Set GEMINI_API_KEY (free at aistudio.google.com/apikey) or ANTHROPIC_API_KEY.",
  );
}

export function judgeLabel() {
  return judgeProvider() === "gemini" ? `Gemini (${env().GEMINI_MODEL})` : `Claude (${env().ANTHROPIC_MODEL})`;
}

export async function runJudge(prompt: JudgePrompt): Promise<LlmVerdict> {
  const raw = judgeProvider() === "gemini" ? await runGemini(prompt) : await runAnthropic(prompt);
  return LlmVerdictSchema.parse(raw);
}
