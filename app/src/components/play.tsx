"use client";

import { useEffect, useRef, useState } from "react";
import { api, type AttemptResult, type Scenario, type TwinCard } from "@/lib/api";
import {
  createPasskeyAccount,
  passkeysSupported,
  signInWithPasskey,
  signOwnerProof,
  type PasskeyAccount,
} from "@/lib/passkey";
import { lastPlayer, rememberPlayer } from "@/lib/session";
import { Button, Card, ErrorNote, Field, inputClass, Spinner } from "./ui";
import { Verdict } from "./verdict";

type Step = "loading" | "identity" | "answer" | "judging" | "verdict";

const JUDGING_LINES = (name: string) => [
  "Reading your answers…",
  `Comparing them with how ${name} actually texts…`,
  `${name}'s twin is making up its mind…`,
  "Posting the verdict on Monad…",
];

export function Play({ slug, mode }: { slug: string; mode: "owner" | "challenger" }) {
  const [twin, setTwin] = useState<TwinCard | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [step, setStep] = useState<Step>("loading");
  const [round, setRound] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [address, setAddress] = useState("");
  const [pasteMode, setPasteMode] = useState(false);
  const [answers, setAnswers] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [judgingLine, setJudgingLine] = useState(0);
  const passkeyRef = useRef<PasskeyAccount | null>(null);

  // Loads the twin card and a fresh set of scenarios; `round` restarts it after a verdict.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ twin }, { scenarios }] = await Promise.all([api.getTwin(slug), api.getScenarios(slug)]);
        if (cancelled) return;
        setTwin(twin);
        setScenarios(scenarios);
        setAnswers(scenarios.map(() => ""));
        setIndex(0);
        const remembered = lastPlayer();
        if (remembered && mode === "challenger") {
          setDisplayName(remembered.displayName);
          setAddress(remembered.address);
        }
        setStep("identity");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load this twin");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, mode, round]);

  useEffect(() => {
    if (step !== "judging") return;
    const id = setInterval(() => setJudgingLine((n) => Math.min(n + 1, 3)), 2500);
    return () => clearInterval(id);
  }, [step]);

  function restart() {
    setResult(null);
    setError(null);
    setStep("loading");
    setRound((r) => r + 1);
  }

  async function connectPasskey(how: "create" | "signin") {
    setError(null);
    if (!passkeysSupported()) {
      setError("This browser can't use passkeys. Paste an address instead.");
      setPasteMode(true);
      return;
    }
    setBusy(true);
    try {
      const passkey =
        how === "create" ? await createPasskeyAccount(displayName.trim() || "Stand-In player") : await signInWithPasskey();
      if (mode === "owner" && twin && passkey.address.toLowerCase() !== twin.ownerAddress.toLowerCase()) {
        passkey.end();
        throw new Error(`That passkey isn't ${twin.name}'s. Use the one you made this twin with.`);
      }
      passkeyRef.current?.end();
      passkeyRef.current = passkey;
      setAddress(passkey.address);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Passkey failed");
    } finally {
      setBusy(false);
    }
  }

  function startAnswering() {
    if (!displayName.trim()) return setError("Pick a name for the leaderboard.");
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return setError("You need an address for the twin to pay. Use a passkey or paste one.");
    }
    if (mode === "owner" && !passkeyRef.current) {
      return setError("Owners sign in with their passkey so the twin knows it's really you.");
    }
    setError(null);
    if (mode === "challenger") rememberPlayer({ displayName: displayName.trim(), address });
    setStep("answer");
  }

  async function submit() {
    if (!twin) return;
    setError(null);
    setJudgingLine(0);
    setStep("judging");
    try {
      const proof =
        mode === "owner" && passkeyRef.current ? await signOwnerProof(passkeyRef.current, slug, "prove") : undefined;
      const { attempt } = await api.submitAttempt(slug, {
        mode,
        address,
        displayName: displayName.trim(),
        scenarioIds: scenarios.map((s) => s.id),
        answers: answers.map((a) => a.trim()),
        proof,
      });
      passkeyRef.current?.end();
      passkeyRef.current = null;
      setResult(attempt);
      setStep("verdict");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The twin couldn't judge that");
      setStep("answer");
    }
  }

  if (step === "loading") {
    return (
      <div className="space-y-4">
        {error ? (
          <ErrorNote>{error}</ErrorNote>
        ) : (
          <div className="flex items-center gap-3 text-muted">
            <Spinner /> Loading…
          </div>
        )}
      </div>
    );
  }
  if (!twin) return <ErrorNote>{error ?? "No such twin"}</ErrorNote>;

  if (step === "verdict" && result) {
    return (
      <Verdict result={result} twinName={twin.name} slug={slug} scenarios={scenarios} answers={answers} onRetry={restart} />
    );
  }

  if (step === "judging") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <Spinner />
        <p className="text-lg font-medium">{JUDGING_LINES(twin.name)[judgingLine]}</p>
        <p className="text-sm text-muted">Usually 10 to 20 seconds.</p>
      </div>
    );
  }

  if (step === "identity") {
    const owner = mode === "owner";
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{owner ? "Prove you're you" : `Be ${twin.name}`}</h1>
          <p className="text-muted">
            {owner
              ? "Answer three texts as yourself. Your score becomes the bar your friends have to beat."
              : `Answer three texts the way ${twin.name} would. Beat ${(twin.ownerScoreBps / 100).toFixed(1)}% and the twin pays you the pot.`}
          </p>
        </div>

        <Card className="space-y-4">
          <Field label="Name on the leaderboard">
            <input
              className={inputClass}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              placeholder={owner ? twin.name : "Sarah"}
            />
          </Field>

          {address ? (
            <p className="rounded-2xl bg-background px-4 py-3 text-sm">
              Paying to <span className="font-mono text-xs">{address}</span>
            </p>
          ) : owner ? (
            <Button variant="secondary" onClick={() => connectPasskey("signin")} loading={busy}>
              Sign in with your passkey
            </Button>
          ) : pasteMode ? (
            <Field label="Address the twin should pay" hint="Any Monad address. Nothing is sent from it.">
              <input
                className={`${inputClass} font-mono text-sm`}
                value={address}
                onChange={(e) => setAddress(e.target.value.trim())}
                placeholder="0x…"
              />
            </Field>
          ) : (
            <div className="space-y-2">
              <Button variant="secondary" onClick={() => connectPasskey("create")} loading={busy}>
                Face ID / fingerprint (new here)
              </Button>
              <Button variant="ghost" onClick={() => connectPasskey("signin")} disabled={busy}>
                I have a Stand-In passkey
              </Button>
              <Button variant="ghost" onClick={() => setPasteMode(true)} disabled={busy}>
                Paste an address instead
              </Button>
            </div>
          )}
          {address && !owner && (
            <Button variant="ghost" onClick={() => setAddress("")}>
              Use a different address
            </Button>
          )}
        </Card>

        <ErrorNote>{error}</ErrorNote>
        <Button onClick={startAnswering} disabled={busy}>
          Start
        </Button>
      </div>
    );
  }

  const scenario = scenarios[index];
  const current = answers[index] ?? "";
  const last = index === scenarios.length - 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          {index + 1} of {scenarios.length}
        </span>
        <span>{mode === "owner" ? "as yourself" : `as ${twin.name}`}</span>
      </div>

      <Card className="space-y-4">
        <p className="rounded-2xl rounded-bl-sm bg-background px-4 py-3 text-base">{scenario.prompt}</p>
        <textarea
          autoFocus
          className={`${inputClass} min-h-32 resize-y`}
          value={current}
          maxLength={400}
          onChange={(e) => setAnswers((prev) => prev.map((a, i) => (i === index ? e.target.value : a)))}
          placeholder={mode === "owner" ? "Type it how you'd actually send it" : `Type it how ${twin.name} would send it`}
        />
        <p className="text-right text-xs text-muted">{current.length}/400</p>
      </Card>

      <ErrorNote>{error}</ErrorNote>

      <div className="grid grid-cols-3 gap-3">
        <Button variant="ghost" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
          Back
        </Button>
        <Button
          className="col-span-2"
          onClick={() => (last ? void submit() : setIndex((i) => i + 1))}
          disabled={current.trim().length === 0}
        >
          {last ? "Send it to the twin" : "Next"}
        </Button>
      </div>
    </div>
  );
}
