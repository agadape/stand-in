"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, formatMon, pct, type TwinCard } from "@/lib/api";
import type { BondRow } from "@/lib/bonds";
import { signInWithPasskey, signOwnerProof } from "@/lib/passkey";
import { useIsOwner } from "@/lib/use-session";
import { befriend } from "./meet";
import { PetScene, SocialProgress } from "./pet-scene";
import { ShowCode } from "./show-code";
import { Address, Button, Card, ErrorNote, LinkButton, Pill } from "./ui";

/** Pet Home: the pet, how many friends it has met, and the one thing to do next. */
export function TwinView({
  twin,
  bonds,
  meetUrl,
  gatheringId,
  welcome,
}: {
  twin: TwinCard;
  bonds: BondRow[];
  meetUrl: string;
  /** Set when the owner arrived from a gathering's page: their codes are stamped with it. */
  gatheringId: number;
  welcome: boolean;
}) {
  const router = useRouter();
  const isOwner = useIsOwner(twin.slug, twin.ownerAddress);
  const [busy, setBusy] = useState<null | "fund" | `bond:${string}`>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  async function fundPot() {
    setError(null);
    setBusy("fund");
    try {
      const passkey = await signInWithPasskey();
      if (passkey.address.toLowerCase() !== twin.ownerAddress.toLowerCase()) {
        throw new Error("That passkey isn't this pet's owner.");
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
            Show your code to someone you meet and your pets will talk. Every friend you meet gets your pet closer
            to something new to wear.
          </p>
        </Card>
      )}

      <section className="space-y-4">
        <PetScene slug={twin.slug} name={twin.name} friends={friends.length} />
        <div className="text-center">
          <h1 className="text-4xl font-semibold tracking-tight">{twin.name}</h1>
          {twin.bio && <p className="mt-1 text-muted">{twin.bio}</p>}
        </div>
        <SocialProgress friends={friends.length} />
      </section>

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
        <Card className="space-y-4 text-center">
          <h2 className="font-semibold">Met someone? Let them scan your code.</h2>
          <ShowCode pet={twin} gatheringId={gatheringId} />
          <details className="text-left text-xs text-muted">
            <summary className="cursor-pointer text-center">Using an NFC sticker or bracelet instead?</summary>
            <p className="mt-2">
              Write this link to it. A sticker can&apos;t change, so friendships made through it need you to accept
              each one, and are recorded as a link rather than as meeting in person.
            </p>
            <p className="mt-2 break-all font-mono">{meetUrl}</p>
          </details>
        </Card>
      ) : (
        <LinkButton href={`/t/${twin.slug}/meet`}>Become friends with {twin.name}</LinkButton>
      )}

      <div className="grid grid-cols-2 gap-3">
        <LinkButton href={`/t/${twin.slug}/wardrobe`} variant="secondary">
          Wardrobe
        </LinkButton>
        <LinkButton href={`/t/${twin.slug}/activity`} variant="secondary">
          Activity
        </LinkButton>
      </div>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">The imitation game</h2>
          <Pill tone={pot > 0n ? "gold" : "neutral"}>Pot {formatMon(pot)}</Pill>
        </div>
        {isOwner === null ? null : isOwner ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              {twin.ownerProven
                ? `Your bar is ${pct(twin.ownerScoreBps)}. Send the link to friends: whoever out-scores you takes the pot.`
                : "Answer three texts as yourself to set the bar. Then friends can try to text like you."}
            </p>
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
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Answer three texts as {twin.name}. Beat {twin.ownerProven ? pct(twin.ownerScoreBps) : "their score"} and{" "}
              {twin.name}&apos;s pet pays you the pot.
            </p>
            {twin.ownerProven ? (
              <LinkButton variant="secondary" href={`/t/${twin.slug}/play`}>
                Be {twin.name}
              </LinkButton>
            ) : (
              <Button variant="secondary" disabled>
                Waiting for {twin.name} to set the bar
              </Button>
            )}
          </div>
        )}
      </Card>

      <p className="text-center text-xs text-muted">
        {twin.name}&apos;s pet texts like {twin.name} and has its own wallet on Monad,{" "}
        <a href={twin.twinExplorerUrl} target="_blank" rel="noreferrer" className="underline decoration-dotted">
          <Address value={twin.twinAddress} />
        </a>
        . It records every meeting and pays out the imitation game itself.
      </p>
    </div>
  );
}
