"use client";

import { createSecretVaultWithExistingPasskey, decryptSecretVaultWithPasskey, parseSecretVault } from "@category-labs/mera";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ownerProof, startSession } from "@/lib/owner-client";
import { signInWithPasskey } from "@/lib/passkey";
import { rememberOwned } from "@/lib/session";
import { Button, Card, ErrorNote } from "./ui";

type Tier = "private" | "sensitive";

const TIERS: { id: Tier; name: string; blurb: string; placeholder: string }[] = [
  {
    id: "private",
    name: "Private notes",
    blurb: "Things about you that you want kept with your pet: history, preferences, what you're looking for.",
    placeholder: "I'm looking for people who…",
  },
  {
    id: "sensitive",
    name: "Sensitive",
    blurb: "Anything you would never want a platform to read. Use made-up text when testing.",
    placeholder: "Only I can read this.",
  },
];

/**
 * The soul vault. Each tier is encrypted in this browser with a key your passkey derives
 * (a different key per tier, none of them the key that signs for your pet), and only the
 * ciphertext is stored. The town never sees any of it: what the town knows is the card.
 */
export function SoulVault({ pet }: { pet: { slug: string; name: string; ownerAddress: string } }) {
  const [stored, setStored] = useState<Record<string, unknown> | null>(null);
  const [text, setText] = useState<Record<Tier, string>>({ private: "", sensitive: "" });
  const [open, setOpen] = useState<Record<Tier, boolean>>({ private: false, sensitive: false });
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/twins/${pet.slug}/vault`, { cache: "no-store" })
      .then((r) => r.json())
      .then((body: { vaults?: { tier: string; vault: unknown }[] }) => {
        if (alive) setStored(Object.fromEntries((body.vaults ?? []).map((v) => [v.tier, v.vault])));
      })
      .catch(() => alive && setStored({}));
    return () => {
      alive = false;
    };
  }, [pet.slug]);

  async function lock(tier: Tier) {
    setError(null);
    setNote(null);
    setBusy(`lock:${tier}`);
    try {
      const secret = new TextEncoder().encode(text[tier]);
      if (secret.length === 0) throw new Error("Write something to lock first.");
      // First prompt: the passkey derives a fresh key for this tier and the text is encrypted here.
      const vault = await createSecretVaultWithExistingPasskey({ rpId: window.location.hostname, secret });
      // Second prompt: prove you own the pet, so only you can replace its ciphertext.
      const auth = await ownerProof(pet, `vault:save:${tier}`);
      const res = await fetch(`/api/twins/${pet.slug}/vault`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...auth, tier, vault }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `Couldn't store it (${res.status})`);
      setStored((s) => ({ ...(s ?? {}), [tier]: vault }));
      setText((t) => ({ ...t, [tier]: "" }));
      setOpen((o) => ({ ...o, [tier]: false }));
      setNote("Locked. Only ciphertext was sent; this page has forgotten the text.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't lock that");
    } finally {
      setBusy(null);
    }
  }

  async function unlock(tier: Tier) {
    setError(null);
    setNote(null);
    setBusy(`unlock:${tier}`);
    try {
      const vault = parseSecretVault(stored?.[tier]);
      const bytes = await decryptSecretVaultWithPasskey({ rpId: window.location.hostname, vault });
      setText((t) => ({ ...t, [tier]: new TextDecoder().decode(bytes) }));
      setOpen((o) => ({ ...o, [tier]: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't unlock that");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-extrabold">{pet.name}&apos;s soul vault</h2>
        <p className="text-xs text-muted">
          Encrypted on this device with a key from your passkey. We store only the ciphertext and cannot read it.
          Nothing here is shown to the town or sent to any AI model.
        </p>
      </div>

      {TIERS.map((tier) => {
        const has = Boolean(stored?.[tier.id]);
        const editing = open[tier.id] || !has;
        return (
          <div key={tier.id} className="space-y-2 rounded-2xl border-2 border-border p-3">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-extrabold">{tier.name}</h3>
              <span className={`text-xs font-extrabold ${has ? "text-accent-strong" : "text-muted"}`}>
                {stored === null ? "…" : has ? "Locked" : "Empty"}
              </span>
            </div>
            <p className="text-xs text-muted">{tier.blurb}</p>
            {editing ? (
              <>
                <textarea
                  className="min-h-24 w-full resize-y rounded-2xl border-2 border-border bg-paper px-4 py-3 text-base outline-none focus:border-blue"
                  value={text[tier.id]}
                  onChange={(e) => setText((t) => ({ ...t, [tier.id]: e.target.value }))}
                  maxLength={2000}
                  placeholder={tier.placeholder}
                  aria-label={tier.name}
                />
                <Button onClick={() => lock(tier.id)} loading={busy === `lock:${tier.id}`} disabled={stored === null}>
                  {busy === `lock:${tier.id}` ? "Two passkey prompts…" : has ? "Lock the new version" : "Lock with my passkey"}
                </Button>
              </>
            ) : (
              <Button variant="secondary" onClick={() => unlock(tier.id)} loading={busy === `unlock:${tier.id}`}>
                {busy === `unlock:${tier.id}` ? "Waiting for your passkey…" : "Unlock to read or edit"}
              </Button>
            )}
          </div>
        );
      })}

      <ErrorNote>{error}</ErrorNote>
      {note && <p className="text-sm font-extrabold text-accent-strong">{note}</p>}
      <p className="text-xs text-muted">
        Try it: clear this site&apos;s data or open a private window, tap &quot;I already have a pet&quot; on the home page, and
        unlock again. The same passkey derives the same keys; nothing was kept in the browser.
      </p>
    </Card>
  );
}

/**
 * Finds your pet again from the passkey alone, for a browser that remembers nothing: the
 * passkey gives the address, and the address gives the pet.
 */
export function RestorePet({ className = "", label = "I already have a pet" }: { className?: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function restore() {
    setError(null);
    setBusy(true);
    try {
      const passkey = await signInWithPasskey();
      try {
        const res = await fetch(`/api/owners/${passkey.address}`, { cache: "no-store" });
        const { pets } = (await res.json()) as { pets: { slug: string; name: string; ownerAddress: string }[] };
        if (!pets?.length) throw new Error("That passkey doesn't own a pet here yet.");
        for (const p of pets) rememberOwned(p.slug, p.ownerAddress, p.name);
        // Signing in is what opens the world: the same unlocked key proves the pet is theirs.
        await startSession(passkey, pets[pets.length - 1].slug);
      } finally {
        passkey.end();
      }
      // Back home: the world, with their pet and its history where they left them.
      router.push("/world");
      // The shell is chosen on the server from the session, so ask for it again now that there is one.
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't find your pet");
      setBusy(false);
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <Button variant="ghost" onClick={restore} loading={busy}>
        {busy ? "Waiting for your passkey…" : label}
      </Button>
      <ErrorNote>{error}</ErrorNote>
    </div>
  );
}
