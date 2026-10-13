"use client";

import { useEffect, useState } from "react";
import type { Wall } from "@/lib/wall";
import { Stat } from "./ui";

const POLL_MS = 3000;
const SIZE = 600;
const NEW_FOR_MS = 12_000;

/**
 * The meeting graph, redrawn every few seconds from the contract. Pets sit on a circle
 * in the order they first appeared, so nobody jumps when someone new arrives; a meeting
 * that just landed glows for a few seconds.
 */
export function WallGraph({ initial, gatheringId = 0 }: { initial: Wall; gatheringId?: number }) {
  const [wall, setWall] = useState(initial);
  const [now, setNow] = useState(0);
  // When each meeting was first seen here, to light up the new ones.
  const [seen, setSeen] = useState(() => new Map<string, number>(initial.edges.map((e) => [`${e.a}-${e.b}`, 0])));

  useEffect(() => {
    let stop = false;
    async function poll() {
      try {
        const res = await fetch(`/api/wall${gatheringId ? `?g=${gatheringId}` : ""}`, { cache: "no-store" });
        if (!res.ok || stop) return;
        const next = (await res.json()) as Wall;
        const at = Date.now();
        setSeen((prev) => {
          const added = next.edges.map((e) => `${e.a}-${e.b}`).filter((key) => !prev.has(key));
          return added.length ? new Map([...prev, ...added.map((key) => [key, at] as const)]) : prev;
        });
        setWall(next);
        setNow(at);
      } catch {
        // A missed poll is fine; the next one catches up.
      }
    }
    const timer = setInterval(poll, POLL_MS);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [gatheringId]);

  const n = wall.nodes.length;
  const radius = SIZE / 2 - 90;
  const place = new Map(
    wall.nodes.map((node, i) => {
      const angle = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2;
      // Rounded, because the server and the browser disagree in the last digit of a cosine and React
      // then reports the page as mismatched.
      const round = (v: number) => Math.round(v * 100) / 100;
      return [node.address, { x: round(SIZE / 2 + Math.cos(angle) * radius), y: round(SIZE / 2 + Math.sin(angle) * radius), angle }];
    }),
  );
  // Meetings already there when the page loaded (seen at 0) never glow.
  const isNew = (key: string) => (seen.get(key) ?? 0) > 0 && now - (seen.get(key) ?? 0) < NEW_FOR_MS;

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-3 gap-3 text-center">
        <Stat tone="gold" label="Meetings" value={wall.counts.meets} />
        <Stat tone="blue" label="Pets" value={wall.counts.pets} />
        <Stat tone="green" label="In person" value={wall.counts.inPerson} />
      </dl>

      {n === 0 ? (
        <p className="rounded-3xl border-2 border-dashed border-border bg-card/60 p-8 text-center text-sm font-bold text-muted">
          Nobody has met yet. The first scan shows up here within a few seconds.
        </p>
      ) : (
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full rounded-3xl border-2 border-b-4 border-border bg-card" role="img" aria-label={`${wall.counts.meets} meetings between ${wall.counts.pets} pets`}>
          {wall.edges.map((e) => {
            const a = place.get(e.a);
            const b = place.get(e.b);
            if (!a || !b) return null;
            const fresh = isNew(`${e.a}-${e.b}`);
            return (
              <line
                key={`${e.a}-${e.b}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={fresh ? "var(--gold)" : e.inPerson ? "var(--accent)" : "var(--border)"}
                strokeWidth={fresh ? 5 : 2.5}
                strokeDasharray={e.inPerson ? undefined : "6 6"}
                strokeLinecap="round"
                opacity={fresh ? 1 : 0.8}
              />
            );
          })}
          {wall.nodes.map((node) => {
            const p = place.get(node.address);
            if (!p) return null;
            const right = Math.cos(p.angle) >= 0;
            return (
              <g key={node.address}>
                <circle cx={p.x} cy={p.y} r={12} fill="#836EF9" stroke="var(--card)" strokeWidth={4} />
                <text
                  x={p.x + (right ? 16 : -16)}
                  y={p.y + 5}
                  textAnchor={right ? "start" : "end"}
                  fill="var(--foreground)"
                  fontSize={n > 16 ? 13 : 17}
                  fontWeight={800}
                >
                  {node.name}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      <p className="text-center text-xs text-muted">
        Solid lines met in person (a fresh code was scanned); dashed lines are links. Read straight from the contract
        every {POLL_MS / 1000} seconds.
      </p>
    </div>
  );
}
