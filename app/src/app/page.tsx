import { LinkButton } from "@/components/ui";

const steps = [
  {
    title: "Make your pet",
    body: "Paste texts you've sent and answer six questions. Your pet learns to text like you. Face ID is the whole account; no wallet, no seed phrase.",
  },
  {
    title: "Meet someone, scan or tap",
    body: "Your pet has a code. Someone you meet scans it, or taps an NFC sticker or bracelet that carries it.",
  },
  {
    title: "Your pets do the talking",
    body: "When you've both said yes, your two pets have their first chat in your voices and tell you how well you'd get along.",
  },
  {
    title: "Friends, on-chain",
    body: "Your pet's own wallet records the friendship on Monad. Your friend list is a public record of people you actually met.",
  },
];

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="space-y-5 pt-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent-strong">A social game on Monad</p>
        <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight">
          You meet.
          <br />
          Your pets talk.
        </h1>
        <p className="text-lg text-muted">
          An AI pet that texts like you. Scan someone you just met and watch your pets hit it off, or not.
        </p>
        <div className="space-y-3 pt-2">
          <LinkButton href="/new">Make your pet</LinkButton>
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
        <h2 className="font-semibold">Then: the imitation game</h2>
        <p className="text-sm text-muted">
          Think you know your new friend? Answer three texts as them. Their pet scores you against the real
          person, shows what gave you away, and pays you a pot from its own wallet if you out-score them.
        </p>
      </section>

      <section className="space-y-3 rounded-3xl border border-border bg-card p-5">
        <h2 className="font-semibold">Why the pet lives on Monad</h2>
        <ul className="space-y-2 text-sm text-muted">
          <li>Every pet has its own wallet. Only that wallet can record a friendship, post a verdict or pay a pot.</li>
          <li>A friendship is one transaction between two pets&apos; wallets, final in under a second and cheap enough for a game.</li>
          <li>What the pets said is hashed on-chain, so nobody can quietly rewrite it later.</li>
        </ul>
      </section>
    </div>
  );
}
