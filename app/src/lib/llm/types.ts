import { z } from "zod";

/** What every judge model must return, whichever provider produced it. */
export const LlmVerdictSchema = z.object({
  answers: z.array(
    z.object({
      scenarioId: z.string(),
      score: z.number().int().min(0).max(100),
      tell: z.string(),
    }),
  ),
  overall: z.number().int().min(0).max(100),
  verdictLine: z.string(),
});

export type LlmVerdict = z.infer<typeof LlmVerdictSchema>;

/** Plain JSON Schema equivalent of LlmVerdictSchema, for providers that take one. */
export const LLM_VERDICT_JSON_SCHEMA = {
  type: "object",
  properties: {
    answers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          scenarioId: { type: "string" },
          score: { type: "integer", minimum: 0, maximum: 100 },
          tell: { type: "string" },
        },
        required: ["scenarioId", "score", "tell"],
      },
    },
    overall: { type: "integer", minimum: 0, maximum: 100 },
    verdictLine: { type: "string" },
  },
  required: ["answers", "overall", "verdictLine"],
} as const;

/** The three parts of a judging prompt; providers decide how to lay them out. */
export type JudgePrompt = {
  rules: string;
  persona: string;
  candidate: string;
};

/** A provider's unvalidated output plus the exact model that produced it. */
export type JudgeResult = { raw: unknown; model: string };

/** Temporary conditions (rate limits, overload, missing configuration) the player can retry. */
export class JudgeUnavailableError extends Error {}
