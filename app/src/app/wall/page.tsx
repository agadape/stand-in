import type { Metadata } from "next";
import Link from "next/link";
import { CreateGathering } from "@/components/gathering";
import { WallGraph } from "@/components/wall-graph";
import { listGatherings } from "@/lib/met";
import { wall } from "@/lib/wall";

export const metadata: Metadata = { title: "Live wall" };
export const dynamic = "force-dynamic";

/** Everyone who has met, drawn live, and the gatherings that have their own wall. */
export default async function WallPage() {
  const [all, gatherings] = await Promise.all([wall(0), listGatherings()]);
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Live wall</h1>
        <p className="text-muted">Every meeting recorded on Monad, as it happens. Put this on a big screen.</p>
      </div>

      <WallGraph initial={all} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Gatherings</h2>
        {gatherings.length === 0 ? (
          <p className="text-sm text-muted">None yet.</p>
        ) : (
          <ul className="space-y-2">
            {gatherings.map((g) => (
              <li key={g.id}>
                <Link href={`/e/${g.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{g.name}</p>
                    <p className="text-xs text-muted">
                      {g.meets} {g.meets === 1 ? "meeting" : "meetings"} · {g.attendees} there
                    </p>
                  </div>
                  <span className={`text-xs font-semibold ${g.open ? "text-ok" : "text-muted"}`}>
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
