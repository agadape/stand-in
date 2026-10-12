import { env } from "../env";
import { runAnthropic } from "./anthropic";
import { runGemini } from "./gemini";
import { runGroq } from "./groq";
import { JudgeUnavailableError, LlmVerdictSchema, type JudgePrompt, type LlmVerdict } from "./types";

export { JudgeUnavailableError, LlmVerdictSchema } from "./types";
export type { JudgePrompt, LlmVerdict } from "./types";

export type Provider = "anthropic" | "groq" | "gemini";

/**
 * Which model judges. Explicit LLM_PROVIDER wins; otherwise whichever key is present:
 * Anthropic, then Gemini, then Groq. Same prompt parts and output schema for all, but
 * not the same judgement: Groq's open models come last because they score an imitation
 * as high as the owner (docs/runbook.md, "Which models may judge").
 */
export function judgeProvider(): Provider {
  const e = env();
  if (e.LLM_PROVIDER !== "auto") return e.LLM_PROVIDER;
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (e.GEMINI_API_KEY) return "gemini";
  if (e.GROQ_API_KEY) return "groq";
  throw new JudgeUnavailableError(
    "No judge configured. Set GROQ_API_KEY (free at console.groq.com), GEMINI_API_KEY (free at aistudio.google.com/apikey) or ANTHROPIC_API_KEY.",
  );
}

export function judgeLabel() {
  const provider = judgeProvider();
  if (provider === "groq") return `Groq (${env().GROQ_MODEL})`;
  return provider === "gemini" ? `Gemini (${env().GEMINI_MODEL})` : `Claude (${env().ANTHROPIC_MODEL})`;
}

const RUNNERS = { anthropic: runAnthropic, groq: runGroq, gemini: runGemini };

/** Runs the configured judge and returns its validated verdict with the model that wrote it. */
export async function runJudge(prompt: JudgePrompt): Promise<{ verdict: LlmVerdict; model: string }> {
  const { raw, model } = await RUNNERS[judgeProvider()](prompt);
  return { verdict: LlmVerdictSchema.parse(raw), model };
}
