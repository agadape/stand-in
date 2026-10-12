"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, type JoinStatus } from "@/lib/api";
import { ownerProof, useMyPet } from "@/lib/owner-client";
import { Button, Card, ErrorNote, inputClass, LinkButton } from "./ui";

/** Check and Join for one room. Both answers come from the contract, not from this app. */
export function RoomGate({ roomId, roomName }: { roomId: number; roomName: string }) {
  const router = useRouter();
  const pet = useMyPet();
  const [status, setStatus] = useState<JoinStatus | null>(null);
  const [busy, setBusy] = useState<null | "check" | "join">(null);
  const [error, setError] = useState<string | null>(null);
  const [joinedTx, setJoinedTx] = useState<string | null>(null);

  if (pet === undefined) return null;
  if (pet === null) {
    return (
      <Card className="space-y-3 text-center">
        <p className="text-sm text-muted">You need a pet to check whether {roomName} would let you in.</p>
        <LinkButton href="/new">Make your pet</LinkButton>
      </Card>
    );
  }
  const mine = pet;

  async function check() {
    setError(null);
    setBusy("check");
    try {
      setStatus(await api.checkRoom(roomId, mine.slug));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't check");
    } finally {
      setBusy(null);
    }
  }

  async function join() {
    setError(null);
    setBusy("join");
    try {
      const { txUrl } = await api.joinRoom(roomId, await ownerProof(mine, `room:join:${roomId}`));
      setJoinedTx(txUrl);
      setStatus({ ok: false, member: true, vouches: status?.vouches ?? 0, needed: status?.needed ?? 0 });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't join");
      setStatus(await api.checkRoom(roomId, mine.slug).catch(() => status));
    } finally {
      setBusy(null);
    }
  }

  const missing = status ? Math.max(0, status.needed - status.vouches) : 0;

  return (
    <Card className="space-y-4">
      <p className="text-sm text-muted">
        As <span className="font-medium text-foreground">{mine.name}</span>
      </p>

      {status?.member ? (
        <p className="rounded-2xl border border-ok/40 bg-ok/10 px-4 py-3 text-sm text-ok">
          You&apos;re in.{" "}
          {joinedTx && (
            <a href={joinedTx} target="_blank" rel="noreferrer" className="underline decoration-dotted">
              See the transaction
            </a>
          )}
        </p>
      ) : status?.ok ? (
        <p className="rounded-2xl border border-ok/40 bg-ok/10 px-4 py-3 text-sm text-ok">
          {status.vouches} of the {status.needed} members you need have met you. You can join.
        </p>
      ) : status ? (
        <p className="rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">
          {status.vouches} of {status.needed}. Meet {missing} more {missing === 1 ? "member" : "members"} and scan
          their code, then check again.
        </p>
      ) : null}

      <ErrorNote>{error}</ErrorNote>

      {!status?.member && (
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={check} loading={busy === "check"}>
            Check
          </Button>
          <Button onClick={join} loading={busy === "join"} disabled={busy !== null}>
            {busy === "join" ? "Asking…" : "Join"}
          </Button>
        </div>
      )}
      <p className="text-center text-xs text-muted">
        Your pet&apos;s wallet asks the contract. It counts the members who have met you and decides.
      </p>
    </Card>
  );
}

/** Open a new room as this browser's pet. */
export function CreateRoom() {
  const router = useRouter();
  const pet = useMyPet();
  const [name, setName] = useState("");
  const [threshold, setThreshold] = useState(2);
  const [inPersonOnly, setInPersonOnly] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (pet === undefined) return null;
  if (pet === null) {
    return (
      <p className="text-sm text-muted">
        <Link href="/new" className="underline decoration-dotted">
          Make your pet
        </Link>{" "}
        to open a room of your own.
      </p>
    );
  }
  const mine = pet;

  async function create() {
    setError(null);
    setBusy(true);
    try {
      const { id } = await api.createRoom({ ...(await ownerProof(mine, "room:create")), name: name.trim(), threshold, inPersonOnly });
      router.push(`/r/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open the room");
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4">
      <h2 className="font-semibold">Open a room</h2>
      <input
        className={inputClass}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        placeholder="Inner Circle Jogja"
        aria-label="Room name"
      />
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>Members who must have met you</span>
        <select
          className="rounded-xl border border-border bg-background px-3 py-2"
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
        >
          {[1, 2, 3, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>Only count meetings in person (a scanned code)</span>
        <input type="checkbox" className="size-5 accent-accent" checked={inPersonOnly} onChange={(e) => setInPersonOnly(e.target.checked)} />
      </label>
      <ErrorNote>{error}</ErrorNote>
      <Button onClick={create} loading={busy} disabled={name.trim().length < 2}>
        {busy ? "Opening on Monad…" : `Open as ${mine.name}`}
      </Button>
    </Card>
  );
}
