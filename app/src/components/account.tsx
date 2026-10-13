"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/lib/owner-client";
import { Button, Card, ErrorNote, inputClass } from "./ui";

/**
 * Leaving: sign this browser out, or delete the pet for good.
 *
 * Deleting asks for the session and not for a fresh passkey prompt, on purpose. The case
 * it exists for is an owner whose passkey no longer works on this device: they are still
 * signed in from when they made the pet, and that has to be enough to start over.
 */
export function Account({ pet }: { pet: { slug: string; name: string } }) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState<null | "out" | "delete">(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  // The shell is chosen on the server from the session, so ask for it again once the session is gone.
  const goOut = () => {
    router.push("/");
    router.refresh();
  };

  async function leave() {
    setBusy("out");
    await signOut();
    goOut();
  }

  async function remove() {
    setError(null);
    setBusy("delete");
    try {
      const res = await fetch(`/api/twins/${pet.slug}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: typed }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `Couldn't delete (${res.status})`);
      await signOut(pet.slug);
      goOut();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete");
      setBusy(null);
    }
  }

  const matches = typed.trim().toLowerCase() === pet.name.trim().toLowerCase();

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 font-extrabold">
          <span aria-hidden>👤</span> Your account
        </h2>
        <p className="text-xs text-muted">
          Signing out only affects this browser. {pet.name} stays in town, and the same passkey brings you back.
        </p>
      </div>
      <Button variant="secondary" onClick={leave} loading={busy === "out"} disabled={busy !== null}>
        Sign out
      </Button>

      {!confirming ? (
        <Button variant="ghost" onClick={() => setConfirming(true)} disabled={busy !== null}>
          Delete {pet.name}
        </Button>
      ) : (
        <div className="space-y-3 rounded-2xl border-2 border-bad/40 bg-bad/10 p-3">
          <p className="text-sm">
            This removes {pet.name} from the town for good: its card, its bonds, its vault and its history here. It
            cannot be undone. What is already on Monad (the pet&apos;s registration, meetings, introductions) stays
            there.
          </p>
          <label className="block space-y-1 text-sm">
            <span className="font-extrabold">Type {pet.name} to confirm</span>
            <input className={inputClass} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </label>
          <ErrorNote>{error}</ErrorNote>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => (setConfirming(false), setTyped(""), setError(null))} disabled={busy !== null}>
              Keep {pet.name}
            </Button>
            <Button variant="danger" onClick={remove} loading={busy === "delete"} disabled={!matches || busy !== null}>
              Delete for good
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
