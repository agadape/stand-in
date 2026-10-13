import Link from "next/link";
import { formatMon, pct, type LeaderboardRow, type TwinCard } from "@/lib/api";
import type { BondRow } from "@/lib/bonds";
import { Pet } from "./pet";
import { EmptyState, LinkButton, PageHeader, SectionTitle, Stat } from "./ui";

/** Everything that has happened to a pet: who it met, and who tried to be its owner. */
export function Activity({ twin, bonds, leaderboard }: { twin: TwinCard; bonds: BondRow[]; leaderboard: LeaderboardRow[] }) {
  const friends = bonds.filter((b) => b.done);
  return (
    <div className="space-y-8">
      <PageHeader tone="green" eyebrow="Activity" title={`${twin.name}'s story so far`} art={<Pet mood="happy" seed={twin.slug} />}>
        <Link href={`/t/${twin.slug}`} className="underline decoration-dotted">
          {twin.name}
        </Link>
        &apos;s meetings and imitation attempts.
      </PageHeader>

      <div className="space-y-8 lg:grid lg:grid-cols-2 lg:items-start lg:gap-10 lg:space-y-0">
      <section className="space-y-3">
        <SectionTitle icon="🤝">Friends met {friends.length > 0 && `· ${friends.length}`}</SectionTitle>
        {friends.length === 0 ? (
          <>
            <EmptyState art={<Pet mood="idle" seed={twin.slug} />} title="Nobody yet">
              Friends are people {twin.name} met and scanned.
            </EmptyState>
            <LinkButton href="/rooms" variant="ghost">
              See rooms you can join by meeting people
            </LinkButton>
          </>
        ) : (
          <ul className="space-y-2">
            {friends.map((f) => (
              <li key={f.id}>
                <Link href={`/b/${f.id}`} className="tile">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-extrabold">
                      {f.other.name}
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-extrabold ${f.inPerson ? "bg-ok/15 text-ok" : "bg-border/70 text-muted"}`}>
                        {f.inPerson ? "met in person" : "link"}
                      </span>
                    </p>
                    {f.summary && <p className="truncate text-xs text-muted">“{f.summary}”</p>}
                  </div>
                  {f.chemistry !== null && <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-black text-accent-strong tabular-nums">{f.chemistry}%</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle icon="🎭">The imitation game</SectionTitle>
        <dl className="grid grid-cols-3 gap-3 text-center">
          <Stat tone="gold" label={`${twin.name} as ${twin.name}`} value={twin.ownerProven ? pct(twin.ownerScoreBps) : "—"} />
          <Stat tone="blue" label="Best impostor" value={twin.attempts > 0 ? pct(twin.bestScoreBps) : "—"} />
          <Stat label="Attempts" value={twin.attempts} />
        </dl>

        {leaderboard.length === 0 ? (
          <EmptyState art={<Pet mood="suspicious" seed={twin.slug} />} title={`Nobody has tried to be ${twin.name} yet`}>
            Send the link to a friend and see if they can text like you.
          </EmptyState>
        ) : (
          <ol className="space-y-2">
            {leaderboard.map((row, i) => (
              <li key={row.id} className="tile">
                <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${i === 0 ? "bg-[#ffe7a8] text-[#a86e00]" : "bg-border/70 text-muted"}`}>{i + 1}</span>
                <Link href={`/t/${twin.slug}/a/${row.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-extrabold">
                    {row.displayName}
                    {row.mode === "owner" && <span className="ml-2 rounded-full bg-[#fff1c2] px-2 py-0.5 text-[11px] font-extrabold text-[#a86e00]">the real one</span>}
                  </p>
                  <p className="truncate text-xs text-muted">“{row.verdictLine}”</p>
                </Link>
                <div className="text-right">
                  <p className="text-sm font-black tabular-nums">{pct(row.scoreBps)}</p>
                  <a href={row.txUrl} target="_blank" rel="noreferrer" className="text-xs text-muted underline decoration-dotted">
                    {row.mode === "owner"
                      ? "set the bar"
                      : BigInt(row.paidWei) > 0n
                        ? `paid ${formatMon(row.paidWei)}`
                        : row.passed
                          ? "passed"
                          : "tx"}
                  </a>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
      </div>
    </div>
  );
}
