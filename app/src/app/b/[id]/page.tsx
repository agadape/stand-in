import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Shortlist } from "@/components/shortlist";
import { Card, LinkButton } from "@/components/ui";
import { bondRecord } from "@/lib/bonds";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const bond = await bondRecord(Number((await params).id));
  if (!bond) return { title: "Not found" };
  const title = `${bond.a.name} × ${bond.b.name}`;
  return { title, description: bond.chat.summary, openGraph: { title, description: bond.chat.summary } };
}

/** A friendship: who met, what their pets said to each other, and where it is on-chain. */
export default async function BondPage({ params }: Props) {
  const id = Number((await params).id);
  const bond = Number.isInteger(id) ? await bondRecord(id) : null;
  if (!bond) notFound();
  const { a, b, chat } = bond;

  return (
    <div className="space-y-6 pt-4">
      <div className="space-y-2 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent-strong">Friends on Monad</p>
        <h1 className="text-4xl font-semibold tracking-tight">
          <Link href={`/t/${a.slug}`}>{a.name}</Link> <span className="text-muted">×</span>{" "}
          <Link href={`/t/${b.slug}`}>{b.name}</Link>
        </h1>
        <p className="text-muted">“{chat.summary}”</p>
      </div>

      <Card className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted">Chemistry</span>
          <span className="font-mono text-3xl font-semibold">{chat.chemistry}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-pink" style={{ width: `${chat.chemistry}%` }} />
        </div>
      </Card>

      <p
        className={`rounded-2xl border px-4 py-3 text-center text-sm ${
          bond.inPerson ? "border-ok/40 bg-ok/10 text-ok" : "border-border bg-card text-muted"
        }`}
      >
        {bond.inPerson
          ? "Met in person: a fresh code was scanned off one phone's screen, and the contract checked it."
          : "Friends by link: both said yes, but nothing shows they were in the same place."}
        {bond.gatheringId > 0 && (
          <>
            {" "}
            <Link href={`/e/${bond.gatheringId}`} className="underline decoration-dotted">
              At a gathering.
            </Link>
          </>
        )}
      </p>

      <section className={`space-y-3 ${chat.messages.length === 0 ? "hidden" : ""}`}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">What their pets said</h2>
        <ol className="space-y-2">
          {chat.messages.map((m, i) => (
            <li key={i} className={`flex flex-col ${m.from === "a" ? "items-start" : "items-end"}`}>
              <span className="px-2 text-xs text-muted">{m.from === "a" ? a.name : b.name}</span>
              <p
                className={`max-w-[80%] rounded-3xl px-4 py-2 ${
                  m.from === "a" ? "rounded-bl-md bg-card border border-border" : "rounded-br-md bg-accent text-white"
                }`}
              >
                {m.text}
              </p>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted">
          Written by their AI pets, in their voices. Neither person typed this.
        </p>
      </section>

      <Shortlist bondId={bond.id} a={a} b={b} />

      <Card className="space-y-2 text-sm text-muted">
        <p>
          One pet&apos;s wallet wrote this meeting to the ProofOfMet contract, carrying the other pet&apos;s
          signature. Anyone can ask the contract whether these two have met.{" "}
          <a href={bond.txUrl} target="_blank" rel="noreferrer" className="text-foreground underline decoration-dotted">
            See the transaction
          </a>
        </p>
        <p className="break-all font-mono text-xs">{bond.bondHash}</p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <LinkButton href={`/t/${a.slug}/play`} variant="secondary">
          Try to be {a.name}
        </LinkButton>
        <LinkButton href={`/t/${b.slug}/play`} variant="secondary">
          Try to be {b.name}
        </LinkButton>
      </div>
    </div>
  );
}
