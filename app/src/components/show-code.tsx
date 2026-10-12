"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { api, type MeetCode } from "@/lib/api";
import { ownerProof } from "@/lib/owner-client";
import { Button, ErrorNote } from "./ui";

type Batch = { codes: MeetCode[]; shownMs: number; gathering: { id: number; name: string } | null };

/** A QR code as one SVG path, built in the browser so it can change every few seconds. */
function qrPath(text: string) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "L" });
  let d = "";
  for (let y = 0; y < modules.size; y++) {
    for (let x = 0; x < modules.size; x++) {
      if (modules.get(y, x)) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return { d, size: modules.size };
}

/**
 * The owner's rotating code. One Face ID fetches ten minutes of codes signed by the pet's
 * wallet; each is on screen for twenty seconds and dies soon after, so the only way to
 * hold a working one is to be looking at this phone.
 */
export function ShowCode({
  pet,
  gatheringId = 0,
}: {
  pet: { slug: string; name: string; ownerAddress: string };
  gatheringId?: number;
}) {
  const [batch, setBatch] = useState<Batch | null>(null);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!batch) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [batch]);

  async function show() {
    setError(null);
    setBusy(true);
    try {
      const { slug, ...auth } = await ownerProof(pet, "code");
      setBatch(await api.getCodes(slug, { ...auth, gatheringId }));
      setNow(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't get your code");
    } finally {
      setBusy(false);
    }
  }

  const current = batch?.codes.findLast((c) => c.issuedAt * 1000 <= now + 1000);
  const live = batch && current && now < current.issuedAt * 1000 + batch.shownMs ? current : null;
  const secondsLeft = live && batch ? Math.max(1, Math.ceil((live.issuedAt * 1000 + batch.shownMs - now) / 1000)) : 0;

  const qr = useMemo(() => {
    if (!live) return null;
    const code = `${live.issuedAt}.${live.nonce.slice(2)}.${live.signature.slice(2)}`;
    const g = gatheringId ? `&g=${gatheringId}` : "";
    return qrPath(`${window.location.origin}/t/${pet.slug}/meet?c=${code}${g}`);
  }, [live, pet.slug, gatheringId]);

  if (!qr) {
    return (
      <div className="space-y-3">
        <ErrorNote>{error}</ErrorNote>
        <Button onClick={show} loading={busy}>
          {busy ? "Waiting for your passkey…" : batch ? "Show my code again" : "Show my code"}
        </Button>
        <p className="text-xs text-muted">
          The code changes every 20 seconds and works once, so a screenshot of it is useless a minute later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {batch?.gathering && (
        <p className="text-xs font-semibold uppercase tracking-wide text-gold">At {batch.gathering.name}</p>
      )}
      <svg
        viewBox={`-2 -2 ${qr.size + 4} ${qr.size + 4}`}
        className="mx-auto w-64 rounded-2xl bg-white"
        role="img"
        aria-label={`${pet.name}'s meeting code`}
        shapeRendering="crispEdges"
      >
        <path d={qr.d} fill="#0b0b12" />
      </svg>
      <p className="font-mono text-sm text-muted" aria-live="off">
        New code in {secondsLeft}s
      </p>
      <p className="text-xs text-muted">Let them scan this with their phone camera. Scanning it makes you friends.</p>
    </div>
  );
}
