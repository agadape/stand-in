"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { ownerProof, useMyPet } from "@/lib/owner-client";
import { Button, Card, ErrorNote, inputClass, LinkButton } from "./ui";

/** Host a gathering as this browser's pet. It starts now. */
export function CreateGathering() {
  const router = useRouter();
  const pet = useMyPet();
  const [name, setName] = useState("");
  const [hours, setHours] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (pet === undefined) return null;
  if (pet === null) {
    return (
      <p className="text-sm text-muted">
        <Link href="/new" className="underline decoration-dotted">
          Make your pet
        </Link>{" "}
        to host a gathering.
      </p>
    );
  }
  const mine = pet;

  async function create() {
    setError(null);
    setBusy(true);
    try {
      const { id } = await api.createGathering({ ...(await ownerProof(mine, "gathering:create")), name: name.trim(), hours });
      router.push(`/e/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the gathering");
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4">
      <h2 className="flex items-center gap-2 font-extrabold">
        <span aria-hidden>🎪</span> Host a gathering
      </h2>
      <input
        className={inputClass}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
        placeholder="Campus night, Friday"
        aria-label="Gathering name"
      />
      <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
        <span>Runs for</span>
        <select
          className="min-h-11 rounded-xl border-2 border-border bg-background px-3 py-2 text-base font-bold"
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
        >
          {[1, 3, 6, 12, 24].map((h) => (
            <option key={h} value={h}>
              {h} {h === 1 ? "hour" : "hours"}
            </option>
          ))}
        </select>
      </label>
      <ErrorNote>{error}</ErrorNote>
      <Button onClick={create} loading={busy} disabled={name.trim().length < 2}>
        {busy ? "Starting on Monad…" : `Start now as ${mine.name}`}
      </Button>
    </Card>
  );
}

/** Sends the visitor to their own pet with this gathering attached to their code. */
export function JoinGathering({ gatheringId, open }: { gatheringId: number; open: boolean }) {
  const pet = useMyPet();
  if (pet === undefined || !open) return null;
  if (pet === null) return <LinkButton href="/new">Make your pet to take part</LinkButton>;
  return <LinkButton href={`/t/${pet.slug}?g=${gatheringId}`}>Show my code for this gathering</LinkButton>;
}
