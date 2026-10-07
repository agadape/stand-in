"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, formatMon, pct, type LeaderboardRow, type TwinCard } from "@/lib/api";
import { signInWithPasskey, signOwnerProof } from "@/lib/passkey";
import { useIsOwner } from "@/lib/use-session";
import { Address, Button, Card, ErrorNote, LinkButton, Pill } from "./ui";

export function TwinView({
  twin,
  leaderboard,
  welcome,
}: {
  twin: TwinCard;
  leaderboard: LeaderboardRow[];
  welcome: boolean;
}) {
  const router = useRouter();
  const isOwner = useIsOwner(twin.slug, twin.ownerAddress);
  const [busy, setBusy] = useState<null | "fund">(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function fundPot() {
    setError(null);
    setBusy("fund");
    try {
      const passkey = await signInWithPasskey();
      if (passkey.address.toLowerCase() !== twin.ownerAddress.toLowerCase()) {
        throw new Error("That passkey isn't this twin's owner.");
      }
      const proof = await signOwnerProof(passkey, twin.slug, "fund");
      passkey.end();
      await api.fundPot(twin.slug, { address: passkey.address, proof });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't fund the pot");
    } finally {
      setBusy(null);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/t/${twin.slug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn't copy. Long-press the address bar instead.");
    }
  }

  const pot = BigInt(twin.potWei);

  return (
    <div className="space-y-6">
      {welcome && isOwner && (
        <Card className="border-accent/50 bg-accent/10">
          <p className="font-semibold">Your twin is live.</p>
          <p className="mt-1 text-sm text-muted">
            Before anyone can challenge it, you need to set the bar: answer three scenarios as yourself.
          </p>
        </Card>
      )}

      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{twin.name}</h1>
            {twin.bio && <p className="mt-1 text-muted">{twin.bio}</p>}
          </div>
          <Pill tone={pot > 0n ? "gold" : "neutral"}>Pot {formatMon(pot)}</Pill>
        </div>

        <dl className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl bg-background p-3">
            <dt className="text-xs text-muted">
              {twin.name} as {twin.name}
            </dt>
            <dd className="font-mono text-lg font-semibold">{twin.ownerProven ? pct(twin.ownerScoreBps) : "—"}</dd>
          </div>
          <div className="rounded-2xl bg-background p-3">
            <dt className="text-xs text-muted">Best impostor</dt>
            <dd className="font-mono text-lg font-semibold">{twin.attempts > 0 ? pct(twin.bestScoreBps) : "—"}</dd>
          </div>
          <div className="rounded-2xl bg-background p-3">
            <dt className="text-xs text-muted">Attempts</dt>
            <dd className="font-mono text-lg font-semibold">{twin.attempts}</dd>
          </div>
        </dl>

        <p className="text-xs text-muted">
          Twin&apos;s wallet{" "}
          <a href={twin.twinExplorerUrl} target="_blank" rel="noreferrer" className="underline decoration-dotted">
            <Address value={twin.twinAddress} />
          </a>
          . It posts every verdict and pays the pot itself.
        </p>
      </Card>

      <ErrorNote>{error}</ErrorNote>

      {isOwner === null ? null : isOwner ? (
        <div className="space-y-3">
          <LinkButton href={`/t/${twin.slug}/play?mode=owner`}>
            {twin.ownerProven ? "Prove you're you again" : "Prove you're you"}
          </LinkButton>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={fundPot} loading={busy === "fund"}>
              Add demo pot
            </Button>
            <Button variant="secondary" onClick={copyLink}>
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
          <p className="text-center text-xs text-muted">Send the link to friends. Whoever out-scores you takes the pot.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {twin.ownerProven ? (
            <LinkButton href={`/t/${twin.slug}/play`}>Be {twin.name}</LinkButton>
          ) : (
            <Button disabled>Waiting for {twin.name} to set the bar</Button>
          )}
          <p className="text-center text-xs text-muted">
            Answer three texts as {twin.name}. Beat {twin.ownerProven ? pct(twin.ownerScoreBps) : "their score"} and
            the twin pays you.
          </p>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Who&apos;s been {twin.name}</h2>
        {leaderboard.length === 0 ? (
          <p className="text-sm text-muted">Nobody yet.</p>
        ) : (
          <ol className="space-y-2">
            {leaderboard.map((row, i) => (
              <li key={row.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                <span className="w-5 font-mono text-sm text-muted">{i + 1}</span>
                <Link href={`/t/${twin.slug}/a/${row.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {row.displayName}
                    {row.mode === "owner" && <span className="ml-2 text-xs text-gold">the real one</span>}
                  </p>
                  <p className="truncate text-xs text-muted">“{row.verdictLine}”</p>
                </Link>
                <div className="text-right">
                  <p className="font-mono text-sm font-semibold">{pct(row.scoreBps)}</p>
                  <a
                    href={row.txUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-muted underline decoration-dotted"
                  >
                    {BigInt(row.paidWei) > 0n ? `paid ${formatMon(row.paidWei)}` : row.passed ? "passed" : "tx"}
                  </a>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
