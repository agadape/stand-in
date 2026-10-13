"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Provider } from "@/lib/llm";
import { startSession } from "@/lib/owner-client";
import { createPasskeyAccount, passkeysSupported, signInWithPasskey } from "@/lib/passkey";
import { QUIZ } from "@/lib/scenarios";
import { rememberOwned } from "@/lib/session";
import { Pet, type Mood } from "./pet";
import { Button, ErrorNote, Field, ProgressBar, inputClass } from "./ui";

const MIN_SAMPLES = 8;
// Quiz questions shown per step.
const PER_STEP = 2;

// Where the persona goes besides our database when a model judges: every judging call carries it.
const SENT_TO: Record<Provider, string> = {
  gemini:
    "Google's Gemini every time someone is judged. Google may use free-tier requests to improve its products, so leave out anything sensitive.",
  groq: "an open AI model hosted by Groq every time someone is judged, so leave out anything sensitive.",
  anthropic: "Anthropic's Claude every time someone is judged, so leave out anything sensitive.",
};

type Step = { say: string; mood: Mood };

/**
 * Making a pet, a little at a time: name, a line about you, your texts, the six quiz
 * questions two at a time, then the privacy note and the passkey. Nothing is sent until
 * the last step.
 */
export function CreateTwin({ judge, next }: { judge: Provider | "stylometry" | null; next: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
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

  const quizSteps = Math.ceil(QUIZ.length / PER_STEP);
  const who = name.trim() || "you";
  const steps: Step[] = [
    { say: "Hi! I'm going to be your pet. What do your friends call you?", mood: "happy" },
    { say: `Nice to meet you, ${who}! Describe yourself in one line.`, mood: "idle" },
    { say: "Now teach me how you text. Paste a few messages you've really sent.", mood: "idle" },
    ...Array.from({ length: quizSteps }, (_, i): Step => ({
      say: i === 0 ? "Quick questions! Answer the way you'd actually type it." : i === quizSteps - 1 ? "Last two, promise." : "You're doing great. Two more.",
      mood: i === quizSteps - 1 ? "happy" : "idle",
    })),
    { say: "That's everything I need. Ready to hatch me? Neither of us knows what I'll turn out to be.", mood: "victory" },
  ];
  const last = steps.length - 1;
  const quizStart = 3;
  const quizIndexes = step >= quizStart && step < last ? QUIZ.map((_, i) => i).slice((step - quizStart) * PER_STEP, (step - quizStart + 1) * PER_STEP) : [];

  const stepDone =
    step === 0
      ? name.trim().length > 0
      : step === 2
        ? samples.length >= MIN_SAMPLES
        : quizIndexes.length > 0
          ? quizIndexes.every((i) => quiz[i].trim().length > 0)
          : true;

  function forward() {
    if (stepDone && step < last) setStep(step + 1);
  }

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
      // Sign in with the key that is already unlocked, so the world opens without another prompt.
      // If that fails the pet still exists; the door at /enter will ask for the passkey.
      await startSession(passkey, created.slug).catch(() => undefined);
      passkey.end();
      rememberOwned(created.slug, passkey.address, name.trim());
      // A new pet lands in the world, its home, unless it was made in order to meet someone.
      router.push(next ?? "/world?welcome=1");
      // The shell is chosen on the server from the session, so ask for it again now that there is one.
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(null);
    }
  }

  return (
    <div className="narrow flex min-h-[70dvh] flex-col gap-6">
      <div className="flex items-center gap-3">
        {step === 0 ? (
          <Link href="/" aria-label="Close" className="flex size-11 shrink-0 items-center justify-center text-2xl text-muted">
            ×
          </Link>
        ) : (
          <button
            type="button"
            aria-label="Back"
            onClick={() => setStep(step - 1)}
            disabled={busy !== null}
            className="flex size-11 shrink-0 items-center justify-center text-2xl text-muted"
          >
            ‹
          </button>
        )}
        <ProgressBar value={step / last} label={`Step ${step + 1} of ${steps.length}`} />
      </div>

      <div className="flex items-end gap-3">
        <Pet mood={steps[step].mood} className="w-24 shrink-0" />
        <p className="mb-4 rounded-2xl rounded-bl-sm border-2 border-border px-4 py-3 text-base" aria-live="polite">
          {steps[step].say}
        </p>
      </div>

      {/* Enter moves on from a one-line answer; the passkey step has its own buttons. */}
      <form
        className="flex flex-1 flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          forward();
        }}
      >
        <div className="flex-1 space-y-5">
          {step === 0 && (
            <Field label="Your name" hint="It shows on your pet's page.">
              <input autoFocus className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Dave" />
            </Field>
          )}

          {step === 1 && (
            <Field label="One line about you" hint="Optional. Everyone who meets your pet sees it.">
              <input
                autoFocus
                className={inputClass}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={280}
                placeholder="chronically late, allergic to capital letters"
              />
            </Field>
          )}

          {step === 2 && (
            <Field
              label="Texts you've sent"
              hint={
                <>
                  One per line. Copy them straight out of your chats; the messier the better.{" "}
                  <span className={`font-extrabold ${samples.length >= MIN_SAMPLES ? "text-ok" : "text-foreground"}`}>
                    {samples.length} of {MIN_SAMPLES}
                  </span>
                  {samples.length >= MIN_SAMPLES ? ", more is better." : " so far."}
                </>
              }
            >
              <textarea
                autoFocus
                className={`${inputClass} min-h-52 resize-y`}
                value={samplesText}
                onChange={(e) => setSamplesText(e.target.value)}
                placeholder={"omw\nlol no\nwait what time is it\n..."}
              />
            </Field>
          )}

          {quizIndexes.map((i, n) => (
            <Field key={QUIZ[i]} label={QUIZ[i]}>
              <input
                autoFocus={n === 0}
                className={inputClass}
                value={quiz[i]}
                maxLength={300}
                onChange={(e) => setQuiz((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
              />
            </Field>
          ))}

          {step === last && (
            <div className="space-y-3 rounded-3xl border-2 border-border p-5 text-sm">
              <p className="font-extrabold">Before you hatch {name.trim()}&apos;s pet</p>
              <p className="text-muted">
                Other players aren&apos;t shown your texts or quiz answers, only what your pet writes in your voice: its
                verdicts and its chats with friends&apos; pets.
              </p>
              {judge === "stylometry" ? (
                <>
                  <p className="text-muted">
                    Both are stored for your pet on our server. The imitation game scores people by counting writing
                    habits, with no AI model. The town only ever gets a short card: your name, your one-liner and a
                    description of how you write.
                  </p>
                  <p className="text-muted">
                    One thing does read your texts: when you meet someone and your pets have their first chat, an open
                    AI model hosted by Groq writes it from both people&apos;s texts. So leave out anything sensitive.
                  </p>
                </>
              ) : (
                <p className="text-muted">
                  Both are stored for your pet and sent to{" "}
                  {judge ? SENT_TO[judge] : "an AI model every time someone is judged, so leave out anything sensitive."} Pet
                  chats are written by an AI model hosted by Groq or Google. The town only ever gets a short card.
                </p>
              )}
              <p className="text-muted">
                No wallet, no seed phrase. The passkey is the account; your pet gets its own wallet and pays the gas.
              </p>
            </div>
          )}

          <ErrorNote>{error}</ErrorNote>
        </div>

        {step < last ? (
          <div className="space-y-2">
            <Button type="submit" disabled={!stepDone}>
              Continue
            </Button>
            {step === 1 && !bio.trim() && <p className="text-center text-xs text-muted">You can leave this empty.</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <Button type="button" onClick={() => submit("create")} loading={busy !== null}>
              {busy === "passkey" ? "Waiting for your passkey…" : busy === "chain" ? "Your pet is hatching on Monad…" : "Hatch with Face ID / fingerprint"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => submit("signin")} disabled={busy !== null}>
              I already have a Stand-In passkey
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
