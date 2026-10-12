import Link from "next/link";
import { formatMon, pct, type LeaderboardRow, type TwinCard } from "@/lib/api";
import type { BondRow } from "@/lib/bonds";
import { LinkButton } from "./ui";

/** Everything that has happened to a pet: who it met, and who tried to be its owner. */
export function Activity({ twin, bonds, leaderboard }: { twin: TwinCard; bonds: BondRow[]; leaderboard: LeaderboardRow[] }) {
  const friends = bonds.filter((b) => b.done);
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Activity</h1>
        <p className="mt-1 text-muted">
          <Link href={`/t/${twin.slug}`} className="underline decoration-dotted">
            {twin.name}
          </Link>
          &apos;s meetings and imitation attempts.
        </p>
      </div>

      <div className="space-y-8 lg:grid lg:grid-cols-2 lg:items-start lg:gap-10 lg:space-y-0">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Friends met {friends.length > 0 && `· ${friends.length}`}
        </h2>
        {friends.length === 0 ? (
          <>
            <p className="text-sm text-muted">Nobody yet. Friends are people {twin.name} met and scanned.</p>
            <LinkButton href="/rooms" variant="ghost">
              See rooms you can join by meeting people
            </LinkButton>
          </>
        ) : (
          <ul className="space-y-2">
            {friends.map((f) => (
              <li key={f.id}>
                <Link href={`/b/${f.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {f.other.name}
                      <span className={`ml-2 text-xs font-normal ${f.inPerson ? "text-ok" : "text-muted"}`}>
                        {f.inPerson ? "met in person" : "link"}
                      </span>
                    </p>
                    {f.summary && <p className="truncate text-xs text-muted">“{f.summary}”</p>}
                  </div>
                  {f.chemistry !== null && <span className="font-mono text-sm font-semibold text-accent">{f.chemistry}%</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">The imitation game</h2>
        <dl className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl border border-border bg-card p-3">
            <dt className="text-xs text-muted">
              {twin.name} as {twin.name}
            </dt>
            <dd className="font-mono text-lg font-semibold">{twin.ownerProven ? pct(twin.ownerScoreBps) : "—"}</dd>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3">
            <dt className="text-xs text-muted">Best impostor</dt>
            <dd className="font-mono text-lg font-semibold">{twin.attempts > 0 ? pct(twin.bestScoreBps) : "—"}</dd>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3">
            <dt className="text-xs text-muted">Attempts</dt>
            <dd className="font-mono text-lg font-semibold">{twin.attempts}</dd>
          </div>
        </dl>

        {leaderboard.length === 0 ? (
          <p className="text-sm text-muted">Nobody has tried to be {twin.name} yet.</p>
        ) : (
          <ol className="space-y-2">
            {leaderboard.map((row, i) => (
              <li key={row.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                <span className="w-5 font-mono text-sm text-muted">{i + 1}</span>
                <Link href={`/t/${twin.slug}/a/${row.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {row.displayName}
                    {row.mode === "owner" && <span className="ml-2 text-xs text-gold">the real one</span>}
                  </p>
                  <p className="truncate text-xs text-muted">“{row.verdictLine}”</p>
                </Link>
                <div className="text-right">
                  <p className="font-mono text-sm font-semibold">{pct(row.scoreBps)}</p>
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
