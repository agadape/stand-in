"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Provider } from "@/lib/llm";
import { createPasskeyAccount, passkeysSupported, signInWithPasskey } from "@/lib/passkey";
import { QUIZ } from "@/lib/scenarios";
import { rememberOwned } from "@/lib/session";
import { Button, Card, ErrorNote, Field, inputClass } from "./ui";

const MIN_SAMPLES = 8;

// Where the persona goes besides our database: every judging call carries it.
const SENT_TO: Record<Provider, string> = {
  gemini:
    "Google's Gemini every time someone is judged. Google may use free-tier requests to improve its products, so leave out anything sensitive.",
  anthropic: "Anthropic's Claude every time someone is judged, so leave out anything sensitive.",
};

export function CreateTwin({ judge }: { judge: Provider | null }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [samplesText, setSamplesText] = useState("");
  const [quiz, setQuiz] = useState<string[]>(() => QUIZ.map(() => ""));
  const [busy, setBusy] = useState<null | "passkey" | "chain">(null);
  const [error, setError] = useState<string | null>(null);

  const samples = useMemo(
    () =>
      samplesText
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
    [samplesText],
  );

  const ready =
    name.trim().length > 0 && samples.length >= MIN_SAMPLES && quiz.every((a) => a.trim().length > 0);

  async function submit(how: "create" | "signin") {
    setError(null);
    if (!passkeysSupported()) {
      setError("This browser can't make passkeys. Try Safari on iOS 18+, Chrome on Android, or a desktop with a password manager.");
      return;
    }
    setBusy("passkey");
    try {
      const passkey = how === "create" ? await createPasskeyAccount(name.trim()) : await signInWithPasskey();
      setBusy("chain");
      const created = await api.createTwin({
        name: name.trim(),
        bio: bio.trim(),
        ownerAddress: passkey.address,
        samples,
        quiz: QUIZ.map((question, i) => ({ question, answer: quiz[i].trim() })),
      });
      passkey.end();
      rememberOwned(created.slug, passkey.address, name.trim());
      router.push(`/t/${created.slug}?welcome=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Make your twin</h1>
        <p className="text-muted">
          Paste some texts you&apos;ve actually sent and answer six questions. Your twin learns how you sound,
          then judges everyone who claims to be you.
        </p>
      </div>

      <Card className="space-y-5">
        <Field label="Your name" hint="What your friends call you.">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Dave" />
        </Field>
        <Field label="One line about you (optional)">
          <input
            className={inputClass}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={280}
            placeholder="chronically late, allergic to capital letters"
          />
        </Field>
        <Field
          label="Texts you've sent"
          hint={
            <>
              One per line, {MIN_SAMPLES} or more. Copy them straight out of your chats; the messier the better.{" "}
              <span className={samples.length >= MIN_SAMPLES ? "text-ok" : ""}>
                {samples.length}/{MIN_SAMPLES}
              </span>
              .
            </>
          }
        >
          <textarea
            className={`${inputClass} min-h-44 resize-y`}
            value={samplesText}
            onChange={(e) => setSamplesText(e.target.value)}
            placeholder={"omw\nlol no\nwait what time is it\n..."}
          />
        </Field>
      </Card>

      <Card className="space-y-5">
        <h2 className="font-semibold">Six quick ones</h2>
        {QUIZ.map((question, i) => (
          <Field key={question} label={question}>
            <input
              className={inputClass}
              value={quiz[i]}
              maxLength={300}
              onChange={(e) => setQuiz((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
            />
          </Field>
        ))}
      </Card>

      <p className="text-xs text-muted">
        Other players aren&apos;t shown your texts or quiz answers, only your twin&apos;s verdicts. Both are stored for
        your twin and sent to{" "}
        {judge ? SENT_TO[judge] : "an AI model every time someone is judged, so leave out anything sensitive."}
      </p>

      <ErrorNote>{error}</ErrorNote>

      <div className="space-y-3">
        <Button onClick={() => submit("create")} disabled={!ready} loading={busy !== null}>
          {busy === "passkey" ? "Waiting for your passkey…" : busy === "chain" ? "Your twin is registering on Monad…" : "Create with Face ID / fingerprint"}
        </Button>
        <Button variant="ghost" onClick={() => submit("signin")} disabled={!ready || busy !== null}>
          I already have a Stand-In passkey
        </Button>
        <p className="text-center text-xs text-muted">
          No wallet, no seed phrase. The passkey is the account; your twin gets its own wallet and pays the gas.
        </p>
      </div>
    </div>
  );
}
