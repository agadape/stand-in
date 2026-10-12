"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, formatMon, pct, type LeaderboardRow, type TwinCard } from "@/lib/api";
import type { BondRow } from "@/lib/bonds";
import { signInWithPasskey, signOwnerProof } from "@/lib/passkey";
import { useIsOwner } from "@/lib/use-session";
import { befriend } from "./meet";
import { Address, Button, Card, ErrorNote, LinkButton, Pill } from "./ui";

export function TwinView({
  twin,
  leaderboard,
  bonds,
  meetUrl,
  qrSvg,
  welcome,
}: {
  twin: TwinCard;
  leaderboard: LeaderboardRow[];
  bonds: BondRow[];
  meetUrl: string;
  qrSvg: string;
  welcome: boolean;
}) {
  const router = useRouter();
  const isOwner = useIsOwner(twin.slug, twin.ownerAddress);
  const [busy, setBusy] = useState<null | "fund" | `bond:${string}`>(null);

  async function accept(other: string) {
    setError(null);
    setBusy(`bond:${other}`);
    try {
      const bond = await befriend(twin, other);
      if (bond.done) router.push(`/b/${bond.id}`);
      else router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't accept");
    } finally {
      setBusy(null);
    }
  }

  const friends = bonds.filter((b) => b.done);
  const requests = bonds.filter((b) => !b.done && b.waitingOnMe);
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
          <p className="font-semibold">Your pet is live.</p>
          <p className="mt-1 text-sm text-muted">
            Show your code to someone you meet and your pets will talk. To open the imitation game, set the bar
            first: answer three scenarios as yourself.
          </p>
        </Card>
      )}

      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{twin.name}</h1>
            {twin.bio && <p className="mt-1 text-muted">{twin.bio}</p>}
          </div>
          <Pill tone={friends.length > 0 ? "ok" : "neutral"}>
            {friends.length} {friends.length === 1 ? "friend" : "friends"}
          </Pill>
        </div>

        <p className="text-xs text-muted">
          {twin.name}&apos;s AI pet texts like {twin.name} and has its own wallet on Monad,{" "}
          <a href={twin.twinExplorerUrl} target="_blank" rel="noreferrer" className="underline decoration-dotted">
            <Address value={twin.twinAddress} />
          </a>
          . It records every friendship and pays out the imitation game itself.
        </p>
      </Card>

      <ErrorNote>{error}</ErrorNote>

      {isOwner && requests.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-accent-strong">Wants to be friends</h2>
          {requests.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-accent/50 bg-accent/10 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.other.name}</p>
                {r.other.bio && <p className="truncate text-xs text-muted">{r.other.bio}</p>}
              </div>
              <Button className="!w-auto" onClick={() => accept(r.other.slug)} loading={busy === `bond:${r.other.slug}`}>
                {busy === `bond:${r.other.slug}` ? "Pets are meeting…" : "Accept"}
              </Button>
            </div>
          ))}
        </section>
      )}

      {isOwner === null ? null : isOwner ? (
        <Card className="space-y-3 text-center">
          <h2 className="font-semibold">Met someone? Let them scan this.</h2>
          <div
            className="mx-auto w-48 overflow-hidden rounded-2xl bg-white p-2"
            role="img"
            aria-label={`QR code for ${meetUrl}`}
            // An SVG string from the qrcode package, built on the server from our own URL.
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <p className="text-xs text-muted">
            Or write this link to an NFC sticker or bracelet and tap phones on it:
            <br />
            <span className="break-all font-mono">{meetUrl}</span>
          </p>
        </Card>
      ) : (
        <LinkButton href={`/t/${twin.slug}/meet`}>Become friends with {twin.name}</LinkButton>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Friends {friends.length > 0 && `· ${friends.length}`}</h2>
        {friends.length === 0 ? (
          <p className="text-sm text-muted">Nobody yet. Friends are people {twin.name} met and scanned.</p>
        ) : (
          <ul className="space-y-2">
            {friends.map((f) => (
              <li key={f.id}>
                <Link href={`/b/${f.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{f.other.name}</p>
                    <p className="truncate text-xs text-muted">“{f.summary}”</p>
                  </div>
                  <span className="font-mono text-sm font-semibold text-pink">{f.chemistry}%</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex items-center justify-between pt-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">The imitation game</h2>
        <Pill tone={pot > 0n ? "gold" : "neutral"}>Pot {formatMon(pot)}</Pill>
      </div>

      <dl className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-2xl border border-border bg-card p-3">
          <dt className="text-xs text-muted">
            {twin.name} as {twin.name}
          </dt>
          <dd className="font-mono text-lg font-semibold">{twin.ownerProven ? pct(twin.ownerScoreBps) : "—"}</dd>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3">
          <dt className="text-xs text-muted">Best impostor</dt>
          <dd className="font-mono text-lg font-semibold">{twin.attempts > 0 ? pct(twin.bestScoreBps) : "—"}</dd>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3">
          <dt className="text-xs text-muted">Attempts</dt>
          <dd className="font-mono text-lg font-semibold">{twin.attempts}</dd>
        </div>
      </dl>

      {isOwner === null ? null : isOwner ? (
        <div className="space-y-3">
          <LinkButton variant="secondary" href={`/t/${twin.slug}/play?mode=owner`}>
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
            <LinkButton variant="secondary" href={`/t/${twin.slug}/play`}>
              Be {twin.name}
            </LinkButton>
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
                    {row.mode === "owner"
                      ? "set the bar"
                      : BigInt(row.paidWei) > 0n
                        ? `paid ${formatMon(row.paidWei)}`
                        : row.passed
                          ? "passed"
                          : "tx"}
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
