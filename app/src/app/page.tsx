import { LinkButton } from "@/components/ui";

const steps = [
  {
    title: "Make your twin",
    body: "Paste texts you've sent and answer six questions. Face ID is the whole account; no wallet, no seed phrase.",
  },
  {
    title: "Set the bar",
    body: "Answer three scenarios as yourself. Your own score is what everyone else has to beat.",
  },
  {
    title: "Send the link",
    body: "Friends answer the same kind of scenarios as you. Your twin scores them and shows its evidence.",
  },
  {
    title: "The twin pays",
    body: "Out-score the real you and the twin's own wallet sends you the pot, in the same transaction as the verdict.",
  },
];

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="space-y-5 pt-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent-strong">A party game on Monad</p>
        <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight">
          Be more you
          <br />
          than you.
        </h1>
        <p className="text-lg text-muted">
          Your friends try to pass as you. Your AI twin decides who&apos;s real, and pays whoever pulls it off.
        </p>
        <div className="space-y-3 pt-2">
          <LinkButton href="/new">Make your twin</LinkButton>
          <p className="text-center text-xs text-muted">Takes about two minutes. Testnet money only.</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">How it works</h2>
        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-4 rounded-3xl border border-border bg-card p-5">
              <span className="font-mono text-2xl font-semibold text-accent-strong">{i + 1}</span>
              <div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3 rounded-3xl border border-border bg-card p-5">
        <h2 className="font-semibold">Why the twin lives on Monad</h2>
        <ul className="space-y-2 text-sm text-muted">
          <li>Every twin has its own wallet. Only that wallet can post a verdict or pay the pot; the app can&apos;t.</li>
          <li>The payout and the verdict are one transaction, final in under a second, cheap enough for a game.</li>
          <li>Each verdict&apos;s hash is on-chain, so anyone holding the stored verdict can check it wasn&apos;t edited.</li>
        </ul>
      </section>
    </div>
  );
}
