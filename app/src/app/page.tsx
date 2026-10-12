import { Pet } from "@/components/pet";
import { LinkButton } from "@/components/ui";

const steps = [
  {
    title: "Make your pet",
    body: "Paste texts you've sent and answer six questions. Your pet learns to text like you. Face ID is the whole account; no wallet, no seed phrase.",
  },
  {
    title: "Meet someone, scan their code",
    body: "Your pet shows a code that changes every 20 seconds and works once. A screenshot is useless a minute later, so scanning it means you were looking at that phone.",
  },
  {
    title: "Your pets do the talking",
    body: "Your two pets have their first chat in your voices and tell you how well you'd get along.",
  },
  {
    title: "Proof of Met, on-chain",
    body: "The meeting is written to a public contract on Monad, signed by both pets. Your friend list is a record of people you actually stood next to.",
  },
];

export default function Home() {
  return (
    <div className="space-y-10">
      {/* One column on a phone; pet beside the pitch from a laptop up. */}
      <section className="space-y-5 pt-2 lg:grid lg:grid-cols-2 lg:items-center lg:gap-10 lg:space-y-0">
        <Pet mood="happy" outfit={{ neck: "bowtie", head: "partyhat" }} className="mx-auto w-48 md:w-64 lg:order-2 lg:w-80" label="A Stand-In pet in a party hat" />
        <div className="space-y-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent-strong">A social game on Monad</p>
        <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight lg:text-6xl">
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
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">How it works</h2>
        <ol className="grid gap-3 md:grid-cols-2">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-4 rounded-3xl border-2 border-border bg-card p-5">
              <span className="font-mono text-2xl font-semibold text-accent-strong">{i + 1}</span>
              <div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
      <section className="space-y-3 rounded-3xl border-2 border-border bg-card p-5">
        <h2 className="font-semibold">Access that follows the person</h2>
        <p className="text-sm text-muted">
          Anyone can open a room with one rule: you get in if enough members have met you in person. No invite
          link to forward, no email to fake. The contract counts and decides, and any other app can ask it the
          same question.
        </p>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <LinkButton href="/rooms" variant="secondary">
            Rooms
          </LinkButton>
          <LinkButton href="/wall" variant="secondary">
            Live wall
          </LinkButton>
        </div>
      </section>

      <section className="space-y-3 rounded-3xl border-2 border-border bg-card p-5">
        <h2 className="font-semibold">Then: the imitation game</h2>
        <p className="text-sm text-muted">
          Think you know your new friend? Answer three texts as them. Their pet scores you against the real
          person, shows what gave you away, and pays you a pot from its own wallet if you out-score them.
        </p>
      </section>

      <section className="space-y-3 rounded-3xl border-2 border-border bg-card p-5">
        <h2 className="font-semibold">Why the pet lives on Monad</h2>
        <ul className="space-y-2 text-sm text-muted">
          <li>Every pet has its own wallet. Only that wallet can record a friendship, post a verdict or pay a pot.</li>
          <li>A meeting is one transaction carrying both pets&apos; signatures, final in under a second and cheap enough for a game.</li>
          <li>The contract itself rejects a stale or reused code, a second record for the same pair, and more than 30 new friends an hour.</li>
          <li>What the pets said is hashed on-chain, so nobody can quietly rewrite it later.</li>
        </ul>
      </section>
      </div>
    </div>
  );
}
