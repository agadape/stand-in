"use client";

import { formatMon, pct, type LlmVerdict, type Scenario } from "@/lib/api";
import { Pet } from "./pet";
import { Card, LinkButton, Pill, ScoreBar, SectionTitle } from "./ui";
import { VerifyVerdict } from "./verify-verdict";

export type VerdictView = {
  id: number;
  mode: "owner" | "challenger";
  scoreBps: number;
  ownerScoreBps: number;
  passed: boolean;
  paidWei: string;
  llm: LlmVerdict;
  styleNotes: string[];
  styleSimilarity: number;
  verdictHash: string;
  judgeModel?: string | null;
  txUrl: string;
};

export function Verdict({
  result,
  twinName,
  slug,
  scenarios,
  answers,
  displayName,
  onRetry,
}: {
  result: VerdictView;
  twinName: string;
  slug: string;
  scenarios: Scenario[];
  answers: string[];
  /** Shown on the public attempt page, where the viewer isn't necessarily the player. */
  displayName?: string;
  onRetry?: () => void;
}) {
  const paid = BigInt(result.paidWei);
  const owner = result.mode === "owner";
  const who = displayName ?? "You";
  const second = displayName === undefined;

  const headline = owner
    ? second
      ? `You're ${pct(result.scoreBps)} you.`
      : `${twinName} is ${pct(result.scoreBps)} ${twinName}.`
    : result.passed
      ? `${who} passed as ${twinName}.`
      : second
        ? `Not ${twinName}.`
        : `${who} is not ${twinName}.`;

  const sub = owner
    ? "That's the bar. Anyone who scores higher takes the pot."
    : result.passed
      ? paid > 0n
        ? `${twinName}'s twin paid ${second ? "you" : who} ${formatMon(paid)}.`
        : "The pot was empty, but the real one got beaten."
      : `${twinName} scored ${pct(result.ownerScoreBps)} as themselves. ${second ? "You" : who} didn't get there.`;

  return (
    <div className="narrow space-y-6">
      {/* The pet's reaction comes first: pleased with its owner, smug at a catch, floored when fooled. */}
      <div
        className={`relative space-y-3 overflow-hidden rounded-3xl border-2 border-b-4 bg-gradient-to-b px-5 pt-6 pb-5 text-center ${
          owner ? "border-[#f2d37a] from-[#ffe7a8] to-[#fff9e8]" : result.passed ? "border-[#b6e58a] from-[#d9f7ba] to-[#f4fde9]" : "border-[#ffb3b3] from-[#ffd9d9] to-[#fff5f5]"
        }`}
      >
        <span aria-hidden className="absolute -top-10 -left-10 size-36 rounded-full bg-white/50" />
        <span aria-hidden className="absolute top-10 -right-8 size-24 rounded-full bg-white/40" />
        <Pet
          mood={owner ? "happy" : result.passed ? "shocked" : "suspicious"}
          className="relative mx-auto w-36"
          label={`${twinName}'s pet ${owner ? "is pleased" : result.passed ? "is shocked" : "is not convinced"}`}
        />
        <div className="relative space-y-2">
          <Pill tone={owner ? "gold" : result.passed ? "ok" : "bad"}>{owner ? "Bar set" : result.passed ? "Passed" : "Caught"}</Pill>
          <h1 className="text-3xl font-black tracking-tight">{headline}</h1>
          <p className="text-foreground/70">{sub}</p>
        </div>
      </div>

      <Card className="space-y-4">
        <ScoreBar scoreBps={result.scoreBps} ownerBps={owner ? 0 : result.ownerScoreBps} label="Twin's verdict" />
        <div className="rounded-2xl rounded-bl-sm bg-accent/15 px-4 py-3 text-sm">
          <p className="mb-1 text-xs font-extrabold text-accent-strong">{twinName}&apos;s pet</p>
          <p>{result.llm.verdictLine}</p>
        </div>
      </Card>

      <section className="space-y-3">
        <SectionTitle icon="🔎">The tells</SectionTitle>
        {result.llm.answers.map((a, i) => (
          <Card key={a.scenarioId} className="space-y-2">
            <p className="text-xs text-muted">{scenarios[i]?.prompt}</p>
            <p className="rounded-2xl rounded-br-sm bg-paper px-4 py-3 text-sm">{answers[i]}</p>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm">{a.tell}</p>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black tabular-nums ${a.score >= 60 ? "bg-accent/15 text-accent-strong" : a.score >= 35 ? "bg-[#fff1c2] text-[#a86e00]" : "bg-bad/15 text-bad"}`}>{a.score}</span>
            </div>
          </Card>
        ))}
      </section>

      {result.styleNotes.length > 0 && (
        <section className="space-y-3">
          <SectionTitle icon="🔢">By the numbers</SectionTitle>
          <Card>
            <ul className="space-y-2 text-sm">
              {result.styleNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">
              {result.judgeModel?.startsWith("stylometry")
                ? "No AI in this score. It is counted from writing habits: which spellings you pick, how you laugh, casing, punctuation, length, emoji. The same answers always get the same score."
                : `Style match ${Math.round(result.styleSimilarity * 100)}%, counted from casing, length, emoji and punctuation habits. It makes up 35% of the score; the twin's read is the other 65%.`}
            </p>
          </Card>
        </section>
      )}

      <VerifyVerdict attemptId={result.id} />

      <Card className="space-y-1 text-xs text-muted">
        <p>
          Verdict posted on Monad by the twin&apos;s wallet:{" "}
          <a href={result.txUrl} target="_blank" rel="noreferrer" className="underline decoration-dotted">
            view transaction
          </a>
        </p>
        <p className="break-all font-mono">verdict hash {result.verdictHash}</p>
        {result.judgeModel && <p>Judged by {result.judgeModel}</p>}
      </Card>

      <div className="space-y-3">
        {owner ? (
          <LinkButton href={`/t/${slug}`}>Back to {second ? "your" : `${twinName}'s`} twin</LinkButton>
        ) : (
          <>
            {onRetry ? (
              <button
                onClick={onRetry}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border-b-4 border-accent-shadow bg-accent px-5 text-sm font-extrabold uppercase tracking-wide text-white hover:brightness-105 active:translate-y-1 active:border-b-0"
              >
                Try again
              </button>
            ) : (
              <LinkButton href={`/t/${slug}/play`}>Be {twinName}</LinkButton>
            )}
            <LinkButton href="/new" variant="secondary">
              Make your own twin
            </LinkButton>
            <LinkButton href={`/t/${slug}`} variant="ghost">
              Back to {twinName}
            </LinkButton>
          </>
        )}
      </div>
    </div>
  );
}
