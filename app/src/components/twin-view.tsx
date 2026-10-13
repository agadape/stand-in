"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, formatMon, pct, type TwinCard } from "@/lib/api";
import type { BondRow } from "@/lib/bonds";
import { forgetPasskey, signInWithPasskey, signOwnerProof } from "@/lib/passkey";
import { useIsOwner } from "@/lib/use-session";
import { Account } from "./account";
import { befriend } from "./meet";
import { PetScene, SocialProgress } from "./pet-scene";
import { ShowCode } from "./show-code";
import { SoulVault } from "./soul-vault";
import { Address, Button, Card, ErrorNote, LinkButton, Pill, SectionTitle } from "./ui";

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
        forgetPasskey();
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
          <p className="font-extrabold">Your pet is live.</p>
          <p className="mt-1 text-sm text-muted">
            Show your code to someone you meet and your pets will talk. Every friend you meet gets your pet closer
            to something new to wear.
          </p>
        </Card>
      )}

      {/* Phone: one column. Laptop: the pet stays on the left while the actions scroll on the right. */}
      <div className="space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-10 lg:space-y-0">
      <section className="space-y-4 lg:sticky lg:top-10">
        {/* The pet on its own stage: a soft purple sky, a shadow on the ground, its name underneath. */}
        <div className="relative overflow-hidden rounded-3xl border-2 border-b-4 border-[#c9bdfd] bg-gradient-to-b from-[#d9d0ff] via-[#efeaff] to-[#f9f7ff] px-5 pt-6 pb-5 text-center">
          <span aria-hidden className="absolute -top-10 -left-10 size-36 rounded-full bg-white/50" />
          <span aria-hidden className="absolute top-12 -right-8 size-24 rounded-full bg-white/40" />
          <div className="relative">
            <PetScene slug={twin.slug} name={twin.name} friends={friends.length} className="w-48 lg:w-72" />
            <span aria-hidden className="mx-auto -mt-3 block h-4 w-40 rounded-[50%] bg-[#6a56e0]/15 lg:w-56" />
            <h1 className="mt-3 text-4xl font-black tracking-tight">{twin.name}</h1>
            {twin.bio && <p className="mt-1 text-foreground/70">{twin.bio}</p>}
          </div>
        </div>
        <Card className="!p-4">
          <SocialProgress friends={friends.length} />
        </Card>
        <div className="grid grid-cols-2 gap-3 max-lg:hidden">
          <LinkButton href={`/t/${twin.slug}/wardrobe`} variant="secondary">
            Wardrobe
          </LinkButton>
          <LinkButton href={`/t/${twin.slug}/activity`} variant="secondary">
            Activity
          </LinkButton>
        </div>
      </section>

      <div className="space-y-6">
      <ErrorNote>{error}</ErrorNote>

      {isOwner && requests.length > 0 && (
        <section className="space-y-2">
          <SectionTitle icon="💌">Wants to be friends</SectionTitle>
          {requests.map((r) => (
            <div key={r.id} className="tile !border-accent/50 !bg-accent/10">
              <div className="min-w-0 flex-1">
                <p className="truncate font-extrabold">{r.other.name}</p>
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
          <h2 className="flex items-center justify-center gap-2 font-extrabold">
            <span aria-hidden>📱</span> Met someone? Let them scan your code.
          </h2>
          <ShowCode pet={twin} gatheringId={gatheringId} />
          <details className="text-left text-xs text-muted">
            <summary className="cursor-pointer py-3 text-center">Using an NFC sticker or bracelet instead?</summary>
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

      <div className="grid grid-cols-2 gap-3 lg:hidden">
        <LinkButton href={`/t/${twin.slug}/wardrobe`} variant="secondary">
          Wardrobe
        </LinkButton>
        <LinkButton href={`/t/${twin.slug}/activity`} variant="secondary">
          Activity
        </LinkButton>
      </div>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-extrabold">
            <span aria-hidden>🎭</span> The imitation game
          </h2>
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

      {isOwner && <SoulVault pet={twin} />}
      {isOwner && <Account pet={twin} />}

      <p className="text-center text-xs text-muted">
        {twin.name}&apos;s pet texts like {twin.name} and has its own wallet on Monad,{" "}
        <a href={twin.twinExplorerUrl} target="_blank" rel="noreferrer" className="underline decoration-dotted">
          <Address value={twin.twinAddress} />
        </a>
        . It records every meeting and pays out the imitation game itself.
      </p>
      </div>
      </div>
    </div>
  );
}
