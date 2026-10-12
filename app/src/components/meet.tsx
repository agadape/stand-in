"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, type MeetCode } from "@/lib/api";
import { ownerProof } from "@/lib/owner-client";
import { useOwned } from "@/lib/use-session";
import { Button, Card, ErrorNote, LinkButton } from "./ui";

export type Scanned = { code: MeetCode; gatheringId: number };

/** Sign the bond with the passkey that owns `from` and send it. Shared by the meet page and the pet page. */
export async function befriend(from: { slug: string; ownerAddress: string }, to: string, scanned?: Scanned | null) {
  const { slug, address, proof } = await ownerProof(from, `bond:${to}`);
  const { bond } = await api.acceptBond({ from: slug, to, address, proof, ...(scanned ?? {}) });
  return bond;
}

export function Meet({
  twin,
  scanned,
}: {
  twin: { slug: string; name: string; bio: string };
  /** The rotating code in the scanned link, if there was one. */
  scanned: Scanned | null;
}) {
  const router = useRouter();
  const owned = useOwned();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (owned === null) return null;
  const mine = Object.entries(owned).find(([slug]) => slug !== twin.slug);
  const isSelf = twin.slug in owned;

  async function accept() {
    if (!mine) return;
    setError(null);
    setBusy(true);
    try {
      const bond = await befriend({ slug: mine[0], ownerAddress: mine[1].ownerAddress }, twin.slug, scanned);
      if (bond.done) router.push(`/b/${bond.id}`);
      else setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send that");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="narrow space-y-6 pt-6">
      <div className="space-y-2 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent-strong">You just met</p>
        <h1 className="text-5xl font-semibold tracking-tight">{twin.name}</h1>
        {twin.bio && <p className="text-muted">{twin.bio}</p>}
      </div>

      <ErrorNote>{error}</ErrorNote>

      {isSelf && !mine ? (
        <Card className="space-y-3 text-center">
          <p className="font-semibold">This is your own code.</p>
          <p className="text-sm text-muted">Show it to someone you meet. They scan it and land here.</p>
          <LinkButton href={`/t/${twin.slug}`} variant="secondary">
            Back to my pet
          </LinkButton>
        </Card>
      ) : sent ? (
        <Card className="space-y-3 border-accent/50 bg-accent/10 text-center">
          <p className="font-semibold">Request sent to {twin.name}.</p>
          <p className="text-sm text-muted">
            This link carries no fresh code, so {twin.name} has to accept on their pet&apos;s page. To be recorded as
            met in person, scan the code on {twin.name}&apos;s screen instead.
          </p>
          <LinkButton href={`/t/${mine?.[0]}`} variant="secondary">
            Back to my pet
          </LinkButton>
        </Card>
      ) : mine ? (
        <div className="space-y-3">
          <Button onClick={accept} loading={busy}>
            {busy ? "Your pets are meeting…" : `Become friends as ${mine[1].name}`}
          </Button>
          <p className="text-center text-xs text-muted">
            {scanned
              ? `You scanned a fresh code off ${twin.name}'s screen. One tap and your pets chat, and the meeting is recorded on Monad as in person.`
              : `No fresh code in this link, so ${twin.name} will need to accept too, and it is recorded as a link, not as meeting in person.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <LinkButton href={`/new?next=${encodeURIComponent(`/t/${twin.slug}/meet`)}`}>Make your pet first</LinkButton>
          <p className="text-center text-xs text-muted">
            Takes two minutes. Then scan {twin.name}&apos;s code again: codes expire in about a minute.
          </p>
        </div>
      )}
    </div>
  );
}
