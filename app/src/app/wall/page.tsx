import type { Metadata } from "next";
import Link from "next/link";
import { CreateGathering } from "@/components/gathering";
import { WallGraph } from "@/components/wall-graph";
import { Pet } from "@/components/pet";
import { EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { listGatherings } from "@/lib/met";
import { wall } from "@/lib/wall";

export const metadata: Metadata = { title: "Live wall" };
export const dynamic = "force-dynamic";

/** Everyone who has met, drawn live, and the gatherings that have their own wall. */
export default async function WallPage() {
  const [all, gatherings] = await Promise.all([wall(0), listGatherings()]);
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader tone="gold" eyebrow="Live wall" title="Everyone who has met" art={<Pet mood="victory" hue={45} />}>
        Every meeting recorded on Monad, as it happens. Put this on a big screen.
      </PageHeader>

      <WallGraph initial={all} />

      <section className="space-y-3">
        <SectionTitle icon="🎪">Gatherings</SectionTitle>
        {gatherings.length === 0 ? (
          <EmptyState art={<Pet mood="idle" hue={45} />} title="No gatherings yet">
            Host one below and its meetings get their own wall.
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {gatherings.map((g) => (
              <li key={g.id}>
                <Link href={`/e/${g.id}`} className="tile">
                  <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#ffe7a8] text-lg">
                    🎪
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-extrabold">{g.name}</p>
                    <p className="text-xs text-muted">
                      {g.meets} {g.meets === 1 ? "meeting" : "meetings"} · {g.attendees} there
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide ${g.open ? "bg-ok/15 text-ok" : "bg-border/70 text-muted"}`}>
                    {g.open ? "on now" : "ended"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CreateGathering />
    </div>
  );
}
