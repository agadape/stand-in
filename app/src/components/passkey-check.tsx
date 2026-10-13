"use client";

import { createPasskeyWithPrfOutput, getPasskeyPrfOutput, isMeraError } from "@category-labs/mera";
import { useEffect, useState } from "react";
import { Button, Card } from "./ui";

/**
 * A diagnostic, not a feature. A browser reports "cancelled", "timed out" and "no passkey
 * here" with the same error, so when a prompt fails on someone's device the only way to
 * tell them apart is to run each kind of request on that device and note what came back
 * and how long it took. This page does that with the same library calls the app makes,
 * and prints a report to copy. It shows no key material: only whether one was returned.
 */

type Made = { credentialId: string; transports?: string[] };
const REMEMBERED = "standin:passkey";

function why(error: unknown) {
  const cause = isMeraError(error) ? (error.cause ?? error) : error;
  const code = isMeraError(error) ? ` [${error.code}]` : "";
  return cause instanceof Error ? `${cause.name}: ${cause.message}${code}` : `${String(cause)}${code}`;
}

async function timed(run: () => Promise<string>) {
  const start = performance.now();
  const focus = `focus ${document.hasFocus() ? "yes" : "NO"}, visible ${document.visibilityState}`;
  try {
    // Wait for the result first: the time is only meaningful once the prompt is over.
    const result = await run();
    return `OK after ${((performance.now() - start) / 1000).toFixed(1)}s: ${result}`;
  } catch (error) {
    // Under about a second means no prompt was shown, or it was refused at once.
    return `FAILED after ${((performance.now() - start) / 1000).toFixed(1)}s (${focus}): ${why(error)}`;
  }
}

export function PasskeyCheck() {
  const [facts, setFacts] = useState<string[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [made, setMade] = useState<Made | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const out: string[] = [`address: ${window.location.origin}`, `browser: ${navigator.userAgent}`, `secure context: ${window.isSecureContext}`];
      const pkc = window.PublicKeyCredential as (typeof PublicKeyCredential & { getClientCapabilities?: () => Promise<Record<string, boolean>> }) | undefined;
      out.push(`WebAuthn: ${pkc ? "yes" : "NO"}`);
      if (pkc) {
        out.push(`built-in authenticator: ${await pkc.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => "error")}`);
        const caps = pkc.getClientCapabilities ? await pkc.getClientCapabilities().catch(() => null) : null;
        out.push(
          caps
            ? `capabilities: ${Object.entries(caps)
                .filter(([k]) => /prf|passkeyPlatform|userVerifying|hybrid|conditionalGet/i.test(k))
                .map(([k, v]) => `${k}=${v}`)
                .join(", ")}`
            : "capabilities: not reported by this browser",
        );
      }
      let stored = "none";
      try {
        const raw = JSON.parse(window.localStorage.getItem(REMEMBERED) ?? "null") as Made | null;
        if (raw?.credentialId) {
          stored = `…${raw.credentialId.slice(-6)} (${raw.transports?.join("/") ?? "no transports"})`;
          if (alive) setMade(raw);
        }
      } catch {}
      out.push(`passkey this device remembers: ${stored}`);
      if (alive) setFacts(out);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const rpId = () => window.location.hostname;
  async function step(label: string, run: () => Promise<string>) {
    setBusy(true);
    const result = await timed(run);
    setLog((l) => [...l, `${label} -> ${result}`]);
    setBusy(false);
  }

  const create = () =>
    step("1. make a passkey", async () => {
      const r = await createPasskeyWithPrfOutput({ rp: { id: rpId(), name: "Stand-In" }, user: { name: "Stand-In check", displayName: "Stand-In check" } });
      const next = { credentialId: r.credentialId, ...(r.transports ? { transports: [...r.transports] } : {}) };
      setMade(next);
      return `passkey …${r.credentialId.slice(-6)}, transports ${r.transports?.join("/") ?? "none"}, key returned: ${r.prfOutput.length === 32}`;
    });
  const useAny = () =>
    step("2. use any passkey", async () => {
      const r = await getPasskeyPrfOutput({ rpId: rpId() });
      return `passkey …${r.credentialId.slice(-6)}, key returned: ${r.prfOutput.length === 32}`;
    });
  const useThis = () =>
    step("3. use that passkey by name", async () => {
      if (!made) throw new Error("no passkey known yet: do step 1 first");
      const r = await getPasskeyPrfOutput({ rpId: rpId(), credential: made });
      return `passkey …${r.credentialId.slice(-6)}, key returned: ${r.prfOutput.length === 32}`;
    });

  const report = [...facts, "", ...log].join("\n");

  return (
    <div className="narrow space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl tracking-tight">Passkey check</h1>
        <p className="text-muted">
          For finding out why a passkey prompt fails on this device. Tap the three buttons in order, approve each
          prompt as you normally would, then copy the report and send it to the team. Step 1 adds a passkey called
          &quot;Stand-In check&quot; to this device; you can delete it afterwards.
        </p>
      </div>
      <Card className="space-y-3">
        <Button onClick={create} disabled={busy}>
          1. Make a passkey
        </Button>
        <Button variant="secondary" onClick={useAny} disabled={busy}>
          2. Use any passkey
        </Button>
        <Button variant="secondary" onClick={useThis} disabled={busy || !made}>
          3. Use that passkey by name
        </Button>
      </Card>
      <Card className="space-y-3">
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-paper p-3 font-mono text-xs">{report || "Reading this device…"}</pre>
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(report);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {}
          }}
        >
          {copied ? "Copied" : "Copy the report"}
        </Button>
      </Card>
    </div>
  );
}
