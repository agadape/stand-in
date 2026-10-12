"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { signInWithPasskey, signOwnerProof } from "@/lib/passkey";
import { useOwned } from "@/lib/use-session";
import { Button, Card, ErrorNote, LinkButton } from "./ui";

/** Sign the bond with the passkey that owns `from` and send it. Shared by the meet page and the pet page. */
export async function befriend(from: { slug: string; ownerAddress: string }, to: string) {
  const passkey = await signInWithPasskey();
  try {
    if (passkey.address.toLowerCase() !== from.ownerAddress.toLowerCase()) {
      throw new Error("That passkey doesn't own your pet on this device.");
    }
    const proof = await signOwnerProof(passkey, from.slug, `bond:${to}`);
    const { bond } = await api.acceptBond({ from: from.slug, to, address: passkey.address, proof });
    return bond;
  } finally {
    passkey.end();
  }
}

export function Meet({ twin }: { twin: { slug: string; name: string; bio: string } }) {
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
      const bond = await befriend({ slug: mine[0], ownerAddress: mine[1].ownerAddress }, twin.slug);
      if (bond.done) router.push(`/b/${bond.id}`);
      else setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send that");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 pt-6">
      <div className="space-y-2 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent-strong">You just met</p>
        <h1 className="text-5xl font-semibold tracking-tight">{twin.name}</h1>
        {twin.bio && <p className="text-muted">{twin.bio}</p>}
      </div>

      <ErrorNote>{error}</ErrorNote>

      {isSelf && !mine ? (
        <Card className="space-y-3 text-center">
          <p className="font-semibold">This is your own tag.</p>
          <p className="text-sm text-muted">Show your code to someone you meet. They scan it and land here.</p>
          <LinkButton href={`/t/${twin.slug}`} variant="secondary">
            Back to my pet
          </LinkButton>
        </Card>
      ) : sent ? (
        <Card className="space-y-3 border-accent/50 bg-accent/10 text-center">
          <p className="font-semibold">Request sent to {twin.name}.</p>
          <p className="text-sm text-muted">
            Now let {twin.name} scan your code, or accept on their pet&apos;s page. The moment they do, your pets
            start talking.
          </p>
          <LinkButton href={`/t/${mine?.[0]}`} variant="secondary">
            Show my code
          </LinkButton>
        </Card>
      ) : mine ? (
        <div className="space-y-3">
          <Button onClick={accept} loading={busy}>
            {busy ? "Your pets are meeting…" : `Become friends as ${mine[1].name}`}
          </Button>
          <p className="text-center text-xs text-muted">
            When you&apos;ve both said yes, your pets have their first chat and the friendship is recorded on Monad.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <LinkButton href={`/new?next=${encodeURIComponent(`/t/${twin.slug}/meet`)}`}>Make your pet first</LinkButton>
          <p className="text-center text-xs text-muted">
            Takes two minutes. Then you come straight back here to befriend {twin.name}.
          </p>
        </div>
      )}
    </div>
  );
}
