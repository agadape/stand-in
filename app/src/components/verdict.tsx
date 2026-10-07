"use client";

import { formatMon, pct, type AttemptResult, type Scenario } from "@/lib/api";
import { Card, LinkButton, Pill, ScoreBar } from "./ui";

export function Verdict({
  result,
  twinName,
  slug,
  scenarios,
  answers,
  onRetry,
}: {
  result: AttemptResult;
  twinName: string;
  slug: string;
  scenarios: Scenario[];
  answers: string[];
  onRetry: () => void;
}) {
  const paid = BigInt(result.paidWei);
  const owner = result.mode === "owner";

  const headline = owner
    ? `You're ${pct(result.scoreBps)} you.`
    : result.passed
      ? `You passed as ${twinName}.`
      : `Not ${twinName}.`;

  const sub = owner
    ? "That's the bar. Anyone who scores higher takes the pot."
    : result.passed
      ? paid > 0n
        ? `${twinName}'s twin just paid you ${formatMon(paid)}.`
        : "The pot was empty, but you beat the real one."
      : `${twinName} scored ${pct(result.ownerScoreBps)} as themselves. You didn't get there.`;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Pill tone={owner ? "gold" : result.passed ? "ok" : "bad"}>
          {owner ? "Bar set" : result.passed ? "Passed" : "Caught"}
        </Pill>
        <h1 className="text-3xl font-semibold tracking-tight">{headline}</h1>
        <p className="text-muted">{sub}</p>
      </div>

      <Card className="space-y-4">
        <ScoreBar scoreBps={result.scoreBps} ownerBps={owner ? 0 : result.ownerScoreBps} label="Twin's verdict" />
        <div className="rounded-2xl rounded-bl-sm bg-accent/15 px-4 py-3 text-sm">
          <p className="mb-1 text-xs text-muted">{twinName}&apos;s twin</p>
          <p>{result.llm.verdictLine}</p>
        </div>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">The tells</h2>
        {result.llm.answers.map((a, i) => (
          <Card key={a.scenarioId} className="space-y-2">
            <p className="text-xs text-muted">{scenarios[i]?.prompt}</p>
            <p className="rounded-2xl rounded-br-sm bg-background px-4 py-3 text-sm">{answers[i]}</p>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm">{a.tell}</p>
              <span className="shrink-0 font-mono text-sm font-semibold">{a.score}</span>
            </div>
          </Card>
        ))}
      </section>

      {result.styleNotes.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">By the numbers</h2>
          <Card>
            <ul className="space-y-2 text-sm">
              {result.styleNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">
              Style match {Math.round(result.styleSimilarity * 100)}%, counted from casing, length, emoji and
              punctuation habits. It makes up 35% of the score; the twin&apos;s read is the other 65%.
            </p>
          </Card>
        </section>
      )}

      <Card className="space-y-1 text-xs text-muted">
        <p>
          Verdict posted on Monad by the twin&apos;s wallet:{" "}
          <a href={result.txUrl} target="_blank" rel="noreferrer" className="underline decoration-dotted">
            view transaction
          </a>
        </p>
        <p className="break-all font-mono">verdict hash {result.verdictHash}</p>
      </Card>

      <div className="space-y-3">
        {owner ? (
          <LinkButton href={`/t/${slug}`}>Back to your twin</LinkButton>
        ) : (
          <>
            <button
              onClick={onRetry}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-accent px-5 font-semibold text-white hover:bg-accent-strong"
            >
              Try again
            </button>
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
