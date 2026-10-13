"use client";

import { createEd25519SigningSession, type Ed25519SigningSession } from "@category-labs/mera";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { MERA_DEFAULT_LABEL, NAMESPACES, fingerprint, ns, toHex } from "@/lib/mera-namespaces";
import { ownerProof, type MyPet } from "@/lib/owner-client";
import { prfForNamespace } from "@/lib/passkey";
import { birthmarkOf, type Birthmark as Mark } from "@/lib/pet-dna";
import { postcardMessage, publicKeyOf, verifyPostcard } from "@/lib/pet-voice";
import { Birthmark } from "./birthmark";
import { Button, Card, ErrorNote, Pill } from "./ui";

type Published = { mark: Mark | null; voiceKey: string | null; postcard: { text: string; signature: string; at: number } | null; arrived: boolean };
type VaultRow = { tier: string; vault: { prfSalt?: string; ciphertext?: string } };

const short = (hex: string, n = 10) => (hex.length > n * 2 + 1 ? `${hex.slice(0, n)}…${hex.slice(-n)}` : hex);

/** One namespace: its label, its salt, and what its 32 bytes became. */
function Row({ label, salt, kind, title, children }: { label: string; salt: string | null; kind: "account" | "not an account"; title: string; children: ReactNode }) {
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold">{title}</h2>
        <Pill tone={kind === "account" ? "neutral" : "ok"}>{kind}</Pill>
      </div>
      <dl className="space-y-1 text-sm">
        <div>
          <dt className="inline font-extrabold">Namespace: </dt>
          <dd className="inline font-mono">{label}</dd>
        </div>
        <div>
          <dt className="inline font-extrabold">PRF salt: </dt>
          <dd className="inline font-mono text-muted">{salt ? short(salt, 12) : "…"}</dd>
        </div>
      </dl>
      {children}
    </Card>
  );
}

/**
 * How this pet uses Mera. One passkey, several namespaces: each is a different PRF salt
 * and gives 32 bytes unrelated to the others. Only one of them is an account. The page
 * shows the salt of each and what its bytes became, never the bytes themselves.
 */
export function MeraPanel({ pet }: { pet: MyPet }) {
  const [salts, setSalts] = useState<{ account: string; dna: string; voice: string } | null>(null);
  const [published, setPublished] = useState<Published | null>(null);
  const [vaults, setVaults] = useState<VaultRow[]>([]);
  const [grown, setGrown] = useState<Mark | null>(null);
  // The public key the DNA namespace's bytes would give, kept to show it is not the voice key.
  const [dnaAsKey, setDnaAsKey] = useState<string | null>(null);
  const [voiceKey, setVoiceKey] = useState<string | null>(null);
  const [voiceTag, setVoiceTag] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [wrongKey, setWrongKey] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const session = useRef<Ed25519SigningSession | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([ns(MERA_DEFAULT_LABEL), ns(NAMESPACES.dna), ns(NAMESPACES.voice)]).then(([a, d, v]) => alive && setSalts({ account: toHex(a), dna: toHex(d), voice: toHex(v) }));
    fetch("/api/world/mark", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Published>) : null))
      .then((p) => {
        if (!alive || !p) return;
        setPublished(p);
        if (p.postcard) {
          setText(p.postcard.text);
          setSignature(p.postcard.signature);
        }
      })
      .catch(() => undefined);
    fetch(`/api/twins/${pet.slug}/vault`, { cache: "no-store" })
      .then((r) => r.json())
      .then((b: { vaults?: VaultRow[] }) => alive && setVaults(b.vaults ?? []))
      .catch(() => undefined);
    return () => {
      alive = false;
      // The voice key leaves memory with the page.
      session.current?.end();
    };
  }, [pet.slug]);

  async function run(name: string, work: () => Promise<void>) {
    setError(null);
    setNote(null);
    setBusy(name);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work");
    } finally {
      setBusy(null);
    }
  }

  const grow = () =>
    run("grow", async () => {
      const seed = await prfForNamespace(NAMESPACES.dna);
      setGrown(await birthmarkOf(seed));
      setDnaAsKey(toHex(publicKeyOf(seed)));
      seed.fill(0);
    });

  const wake = () =>
    run("wake", async () => {
      const seed = await prfForNamespace(NAMESPACES.voice);
      session.current?.end();
      session.current = createEd25519SigningSession({ privateKey: seed });
      seed.fill(0);
      setVoiceKey(toHex(session.current.publicKey));
      setVoiceTag(await fingerprint("voice", session.current.publicKey));
    });

  const sign = () =>
    run("sign", async () => {
      if (!session.current) throw new Error("Wake the voice key first.");
      if (!text.trim()) throw new Error("Write the postcard first.");
      setSignature(toHex(await session.current.signMessage(postcardMessage(pet.slug, text))));
      setWrongKey(false);
    });

  const publish = (what: "mark" | "voice") =>
    run(`publish:${what}`, async () => {
      const auth = await ownerProof(pet, "world:mark");
      const body = what === "mark" ? { ...auth, mark: grown } : { ...auth, voiceKey, ...(signature && checks ? { postcard: { text, signature } } : {}) };
      const res = await fetch("/api/world/mark", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => ({}))) as Published & { error?: string };
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `Couldn't publish (${res.status})`);
      setPublished(json);
      setNote(what === "mark" ? "Published. Anyone in town can now see this mark on your pet's card." : "Published. Anyone can check this postcard against your pet's voice key.");
    });

  // What a reader would check with: the key just woken here, or the one already published.
  const realKey = voiceKey ?? published?.voiceKey ?? null;
  const keyInUse = wrongKey ? dnaAsKey : realKey;
  const checks = Boolean(keyInUse && signature && verifyPostcard(keyInUse, pet.slug, text, signature));
  const onRecord = published?.mark ?? null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-extrabold uppercase tracking-wide text-accent-strong">Built with Mera</p>
        <h1 className="text-3xl tracking-tight">One passkey, many namespaces</h1>
        <p className="text-muted">
          {pet.name}&apos;s passkey is asked for 32 bytes under several namespaces. A namespace is a label; its PRF salt is
          the SHA-256 of that label. Different salt, unrelated bytes: one of them leaking says nothing about the others.
          Only the first is an account. This page shows each salt and what the bytes became, never the bytes.
        </p>
      </div>
      <ErrorNote>{error}</ErrorNote>
      {note && <p className="text-sm font-extrabold text-accent-strong">{note}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Row title="Account" label={`${MERA_DEFAULT_LABEL} (Mera's default)`} salt={salts?.account ?? null} kind="account">
          <p className="text-sm text-muted">
            Becomes the key that proves {pet.name} is yours. Its address: <span className="font-mono text-foreground">{short(pet.ownerAddress, 8)}</span>
          </p>
        </Row>

        <Row title="Soul vault" label="one fresh salt per tier" salt={vaults[0]?.vault.prfSalt ? `${vaults[0].vault.prfSalt} (base64url)` : "nothing locked yet"} kind="not an account">
          <p className="text-sm text-muted">
            {vaults.length === 0
              ? "Becomes an AES-256-GCM key for private notes. "
              : `${vaults.length} tier${vaults.length === 1 ? "" : "s"} locked. The server holds ${vaults.map((v) => `${v.vault.ciphertext?.length ?? 0} characters of ciphertext (${v.tier})`).join(" and ")}. `}
            <Link href={`/t/${pet.slug}`} className="underline decoration-dotted">
              Open the vault
            </Link>
          </p>
        </Row>

        <Row title="Pet DNA" label={NAMESPACES.dna} salt={salts?.dna ?? null} kind="not an account">
          <p className="text-sm text-muted">
            Becomes {pet.name}&apos;s birthmark. Nobody chooses it and the bytes are stored nowhere: the same passkey regrows the
            same mark on any device.
          </p>
          <div className="flex flex-wrap items-center gap-5">
            {grown ? <Birthmark mark={grown} className="w-36 shrink-0" label={`${pet.name}'s birthmark`} /> : <div className="flex size-36 shrink-0 items-center justify-center rounded-3xl border-2 border-dashed border-border text-xs text-muted">not grown here yet</div>}
            <div className="min-w-0 flex-1 space-y-2 text-sm">
              {grown && (
                <p>
                  <span className="font-extrabold">Fingerprint: </span>
                  <span className="font-mono">{grown.fingerprint}</span>
                </p>
              )}
              {onRecord && (
                <p className="flex items-center gap-2">
                  <Birthmark mark={onRecord} className="w-9 shrink-0" />
                  <span>
                    <span className="font-extrabold">On record: </span>
                    <span className="font-mono">{onRecord.fingerprint}</span>
                  </span>
                </p>
              )}
              {grown && onRecord && (
                <p className={`rounded-2xl border-2 px-3 py-2 font-extrabold ${grown.fingerprint === onRecord.fingerprint ? "border-ok/40 bg-ok/10 text-ok" : "border-bad/40 bg-bad/10 text-bad"}`}>
                  {grown.fingerprint === onRecord.fingerprint ? "✓ Match: this passkey regrew the mark on record." : "✗ No match: a different passkey grew the mark on record."}
                </p>
              )}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button onClick={grow} loading={busy === "grow"}>
              {busy === "grow" ? "Waiting for your passkey…" : grown ? "Grow it again" : "Grow from my passkey"}
            </Button>
            <Button variant="secondary" onClick={() => publish("mark")} loading={busy === "publish:mark"} disabled={!grown || grown.fingerprint === onRecord?.fingerprint}>
              {grown && grown.fingerprint === onRecord?.fingerprint ? "Already on record" : "Publish this mark"}
            </Button>
          </div>
        </Row>

        <Row title="Pet voice" label={NAMESPACES.voice} salt={salts?.voice ?? null} kind="not an account">
          <p className="text-sm text-muted">
            Becomes an Ed25519 key that signs {pet.name}&apos;s postcards. Anyone can check one; nobody without the passkey, our
            server included, can write one that passes.
          </p>
          <p className="text-sm">
            <span className="font-extrabold">Public key: </span>
            <span className="font-mono">{realKey ? short(realKey, 12) : "not woken or published yet"}</span>
            {voiceTag && <span className="text-muted"> · tag {voiceTag}</span>}
          </p>
          <textarea
            className="min-h-20 w-full resize-y rounded-2xl border-2 border-border bg-paper px-4 py-3 text-base outline-none focus:border-blue"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={240}
            placeholder="Write a postcard from your pet…"
            aria-label="Postcard"
          />
          {signature && (
            <>
              <p className="break-all font-mono text-xs text-muted">signature {short(signature, 20)}</p>
              <p className={`rounded-2xl border-2 px-3 py-2 text-sm font-extrabold ${checks ? "border-ok/40 bg-ok/10 text-ok" : "border-bad/40 bg-bad/10 text-bad"}`} aria-live="polite">
                {checks
                  ? `✓ Verified: signed by ${pet.name}'s voice key, word for word.`
                  : wrongKey
                    ? "✗ Fails: the DNA namespace gives a different key. It cannot speak for the voice."
                    : "✗ Fails: the text or the key is not what was signed."}
              </p>
            </>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {voiceKey ? (
              <Button onClick={sign} loading={busy === "sign"}>
                Sign this postcard
              </Button>
            ) : (
              <Button onClick={wake} loading={busy === "wake"}>
                {busy === "wake" ? "Waiting for your passkey…" : "Wake the voice key"}
              </Button>
            )}
            <Button variant="secondary" onClick={() => publish("voice")} loading={busy === "publish:voice"} disabled={!voiceKey}>
              Publish key and postcard
            </Button>
          </div>
          {signature && dnaAsKey && (
            <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
              <span>
                <span className="font-extrabold">Check with the DNA namespace&apos;s key instead</span>
                <span className="block font-mono text-xs text-muted">{short(dnaAsKey, 12)}</span>
              </span>
              <input type="checkbox" className="size-6 accent-[var(--bad)]" checked={wrongKey} onChange={(e) => setWrongKey(e.target.checked)} />
            </label>
          )}
        </Row>
      </div>

      <p className="text-xs text-muted">
        Raw passkey output is never shown, stored or sent. Fingerprints and tags are one-way hashes; keys shown here are
        public keys. Calls: <span className="font-mono">getPasskeyPrfOutput</span>, <span className="font-mono">createEd25519SigningSession</span>,{" "}
        <span className="font-mono">createSecretVaultWithExistingPasskey</span> from <span className="font-mono">@category-labs/mera</span>.
      </p>
    </div>
  );
}
