"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, ApiError, type World } from "@/lib/api";
import type { TownScene } from "./town-scene";
import { ownerProof, type MyPet } from "@/lib/owner-client";
import { rememberOwned } from "@/lib/session";
import { WEATHER, WEATHER_KINDS, type WeatherKind } from "@/lib/weather";
import { Pet, type Mood } from "./pet";
import { Button, Card, ErrorNote, LinkButton, Pill } from "./ui";

type Agent = World["agents"][number];
type Pair = World["pairs"][number];

const POLL_MS = 3_000;

const WANTS: Record<string, string> = {
  rest: "a rest (the lake is where they go for that)",
  company: "company (the tavern, or a friend)",
  purpose: "something to do (the guild hall)",
  supplies: "supplies (the market)",
};

function partOfDay(hour: number) {
  return hour < 5 ? "night" : hour < 8 ? "dawn" : hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 20 ? "dusk" : "night";
}

/** The current time, refreshed every second, for countdowns. 0 until the first second has passed. */
function useNow() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** How long `ticks` more ticks will take from now, as m:ss. Counts down between polls. */
function untilTicks(world: World, ticks: number, now: number) {
  const sinceTick = now ? Math.max(0, Math.min(world.tickMs, now - world.lastTickAt)) : 0;
  const seconds = Math.max(0, Math.ceil((ticks * world.tickMs - sinceTick) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * The 3D town. It loads three.js only on this page and only in the browser; if WebGL is
 * not available the flat map passed as children is shown instead, so the world is never
 * a blank box.
 */
function TownStage({
  world,
  mineId,
  selected,
  onPick,
  now,
  children,
}: {
  world: World;
  now: number;
  mineId: number | null;
  selected: number | null;
  onPick: (id: number | null) => void;
  children: ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<TownScene | null>(null);
  const pick = useRef(onPick);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [line, setLine] = useState(0);
  const seenTick = useRef({ tick: -1, at: 0 });

  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);

  useEffect(() => {
    let cancelled = false;
    import("./town-scene")
      .then(({ TownScene }) => {
        if (cancelled || !host.current) return;
        scene.current = new TownScene(host.current, (id) => pick.current(id));
        setReady(true);
      })
      .catch((error) => {
        console.warn("[world] 3D view unavailable, showing the flat map", error);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);

  // The newest talk is read out one line at a time, each in a bubble over whoever said it.
  const talk = world.events.find((e) => e.kind === "talk");
  const lines = talk?.lines ?? null;
  useEffect(() => {
    const first = setTimeout(() => setLine(0), 0);
    if (!lines || lines.length < 2) return () => clearTimeout(first);
    const timer = setInterval(() => setLine((n) => Math.min(n + 1, lines.length - 1)), 1900);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [talk?.id, lines]);

  useEffect(() => {
    if (!scene.current) return;
    if (seenTick.current.tick !== world.tick) seenTick.current = { tick: world.tick, at: performance.now() };
    const said = lines?.[Math.min(line, lines.length - 1)];
    scene.current.update({
      agents: world.agents.map((a) => ({ id: a.id, name: a.name, place: a.place, hue: a.hue, mine: a.id === mineId, owned: Boolean(a.slug), paused: a.paused })),
      hour: world.hour,
      hourAt: seenTick.current.at,
      hourRate: 1000 / world.tickMs,
      buzz: world.buzz,
      talk: talk
        ? { id: talk.id * 10 + (lines ? Math.min(line, lines.length - 1) : 0), aId: talk.aId, bId: talk.bId, delta: talk.delta ?? 0, line: said?.text ?? null, speaker: said ? (said.from === "a" ? talk.aId : talk.bId) : null }
        : null,
      selected,
      weather: world.weather ? { kind: world.weather.kind, place: world.weather.place } : null,
    });
  }, [world, mineId, selected, talk, lines, line, ready]);

  if (failed) return <>{children}</>;
  const latest = world.events.find((e) => e.kind !== "move");
  return (
    <div className="relative h-[58dvh] min-h-[380px] w-full overflow-hidden rounded-3xl border-2 border-border bg-[#cfeaff] lg:h-[70dvh]">
      <div ref={host} className="absolute inset-0 isolate" aria-label="The town, in 3D. Drag to look around; tap a resident to select them." role="application" />
      {!ready && <p className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-foreground/70">Opening the town…</p>}
      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
        <span className="rounded-full bg-white/85 px-3 py-1 text-xs font-extrabold shadow-sm">
          {String(world.hour).padStart(2, "0")}:00 · {partOfDay(world.hour)}
        </span>
        <span className="pointer-events-auto flex gap-2">
          {mineId !== null && (
            <button type="button" onClick={() => scene.current?.focus(mineId)} className="min-h-11 rounded-full bg-white/90 px-4 text-xs font-extrabold uppercase tracking-wide text-blue shadow-sm">
              My pet
            </button>
          )}
          <button type="button" onClick={() => scene.current?.focus(null)} className="min-h-11 rounded-full bg-white/90 px-4 text-xs font-extrabold uppercase tracking-wide text-blue shadow-sm">
            Whole town
          </button>
        </span>
      </div>
      {world.weather && (
        // Who changed the sky, where it is, and how long is left. It links to the payment when there is one.
        <a
          href={world.weather.txUrl ?? undefined}
          target="_blank"
          rel="noreferrer"
          className="absolute left-1/2 top-16 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-x-1 rounded-full bg-blue max-sm:w-max max-sm:flex-wrap max-sm:justify-center max-sm:rounded-2xl px-3 py-1.5 text-[11px] font-extrabold text-white shadow-md sm:text-xs"
        >
          <span aria-hidden className="shrink-0">
            {world.weather.icon}
          </span>
          <span className="min-w-0 truncate">
            {world.weather.label} at {world.places.find((p) => p.id === world.weather?.place)?.name}
          </span>
          <span className="min-w-0 shrink-[20] truncate font-bold opacity-90">· <span className="max-sm:hidden">summoned </span>by {world.weather.byName}</span>
          <span className="shrink-0">· {untilTicks(world, world.weather.ticksLeft, now)} left</span>
        </a>
      )}
      {latest && (
        <p className="pointer-events-none absolute inset-x-3 bottom-3 rounded-2xl bg-white/88 px-4 py-2 text-sm shadow-sm" aria-live="polite">
          {latest.text}
        </p>
      )}
    </div>
  );
}

// Where each place sits on the map, in percent of the board.
const ZONES: Record<string, { x: number; y: number; tint: string }> = {
  tavern: { x: 0, y: 0, tint: "#FFF4D6" },
  market: { x: 50, y: 0, tint: "#E3F6FF" },
  guild: { x: 0, y: 50, tint: "#EFE9FF" },
  lake: { x: 50, y: 50, tint: "#E4F8E0" },
};
const COLS = 4;

/** Where the nth agent in a place stands: a loose grid inside that place's quarter. */
function spot(place: string, n: number) {
  const zone = ZONES[place] ?? ZONES.tavern;
  const col = n % COLS;
  const row = Math.floor(n / COLS);
  return { left: zone.x + 3 + col * 11.5, top: zone.y + 12 + row * 13 };
}

/**
 * The Isekai, live. Everyone can watch; nobody can steer. The page polls the world, and
 * the polling is what keeps it moving.
 */
export function WorldView({ initial, welcome = false, me }: { initial: World; welcome?: boolean; me: MyPet }) {
  const [world, setWorld] = useState(initial);
  const [selected, setSelected] = useState<number | null>(null);
  const [stale, setStale] = useState(false);
  // Who is watching comes from the signed-in session, checked on the server.
  const pet = me;
  const router = useRouter();
  const now = useNow();

  useEffect(() => {
    // Keep this device's memory of its pet in step with the session it is signed in as.
    rememberOwned(me.slug, me.ownerAddress, me.name);
  }, [me]);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api.getWorld().then(
        (w) => alive && (setWorld(w), setStale(false)),
        (error) => {
          // Signed out (or the session ran out): back to the door.
          if (error instanceof ApiError && error.status === 401) router.replace("/enter?next=/world");
          else if (alive) setStale(true);
        },
      );
    const timer = setInterval(() => document.visibilityState === "visible" && load(), POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [router]);

  const byId = useMemo(() => new Map(world.agents.map((a) => [a.id, a])), [world.agents]);
  const mine = pet ? world.agents.find((a) => a.slug === pet.slug) : undefined;
  const focus = selected !== null ? byId.get(selected) : mine;

  // A stable standing order inside each place, so agents don't shuffle when nothing happened.
  const positions = useMemo(() => {
    const counts: Record<string, number> = {};
    const out = new Map<number, { left: number; top: number }>();
    for (const a of [...world.agents].sort((x, y) => x.id - y.id)) {
      if (a.paused) continue;
      counts[a.place] = (counts[a.place] ?? 0) + 1;
      out.set(a.id, spot(a.place, counts[a.place] - 1));
    }
    return out;
  }, [world.agents]);

  // Whoever spoke in the newest talk looks pleased or put out for a moment.
  const lastTalk = world.events.find((e) => e.kind === "talk");
  const moodOf = (a: Agent): Mood =>
    lastTalk && lastTalk.tick >= world.tick - 1 && (lastTalk.aId === a.id || lastTalk.bId === a.id)
      ? (lastTalk.delta ?? 0) >= 6
        ? "victory"
        : (lastTalk.delta ?? 0) > 0
          ? "happy"
          : "suspicious"
      : "idle";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-wide text-accent-strong">The Isekai</p>
          <h1 className="text-3xl tracking-tight">A town of agents living their own lives</h1>
        </div>
        <Pill tone={stale ? "bad" : "ok"}>
          {stale ? "Reconnecting" : `Live · day ${Math.floor(world.tick / world.hours) + 1}, ${String(world.hour).padStart(2, "0")}:00 ${partOfDay(world.hour)}`}
        </Pill>
      </div>

      {welcome && mine && (
        <Card className="border-accent/50 bg-accent/10">
          <p className="font-extrabold">{mine.name} has moved in.</p>
          <p className="mt-1 text-sm text-muted">
            That&apos;s your pet with the gold marker. It will find its own way around. Tune it with the dials, or{" "}
            <Link href={`/t/${mine.slug}`} className="underline decoration-dotted">
              open its page
            </Link>{" "}
            to show your code to someone you meet.
          </p>
        </Card>
      )}
      {!mine && (
        <Card className="flex items-center gap-4">
          <Pet mood="idle" className="w-14 shrink-0" />
          <p className="text-sm text-muted">
            <span className="font-extrabold text-foreground">{pet.name} is on the way into town.</span> New arrivals
            walk in within a few moments.
          </p>
        </Card>
      )}

      <PetLetter world={world} pet={pet} />

          <TownStage world={world} mineId={mine?.id ?? null} selected={focus?.id ?? null} onPick={setSelected} now={now}>
          <div className="relative aspect-square w-full overflow-hidden rounded-3xl border-2 border-border sm:aspect-[4/3]">
            {world.places.map((p) => (
              <div
                key={p.id}
                className="absolute h-1/2 w-1/2 border border-white p-2"
                style={{ left: `${ZONES[p.id].x}%`, top: `${ZONES[p.id].y}%`, background: ZONES[p.id].tint }}
              >
                <p className="text-xs font-extrabold uppercase tracking-wide text-foreground/70">{p.name}</p>
              </div>
            ))}
            {world.agents.map((a) => {
              const at = positions.get(a.id);
              if (!at) return null;
              const isMine = a.id === mine?.id;
              const isFocus = a.id === focus?.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelected(a.id)}
                  aria-label={`${a.name}, at ${world.places.find((p) => p.id === a.place)?.name}`}
                  className={`absolute w-[10.5%] rounded-xl transition-[left,top] duration-[1800ms] ease-in-out ${isFocus ? "z-[2] bg-white/80 ring-2 ring-blue" : ""}`}
                  style={{ left: `${at.left}%`, top: `${at.top}%` }}
                >
                  <Pet mood={moodOf(a)} hue={a.slug ? undefined : a.hue} />
                  <span className={`block truncate text-center text-[10px] font-extrabold leading-tight sm:text-xs ${isMine ? "text-blue" : ""}`}>
                    {a.name}
                  </span>
                </button>
              );
            })}
          </div>
          </TownStage>
          <p className="text-xs text-muted">
            Purple pets belong to people; the colourful ones are made-up townsfolk. Drag to look around, pinch or
            scroll to zoom, tap anyone to see who they are. A day here lasts a couple of minutes, and the town only
            moves while someone is watching it.
          </p>

      <div className="space-y-6 lg:grid lg:grid-cols-[3fr_2fr] lg:items-start lg:gap-8 lg:space-y-0">
        <div className="space-y-6">

          <section className="space-y-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted">Chronicle</h2>
            <ol className="space-y-2">
              {world.events.map((e) => (
                <Entry key={e.id} event={e} byId={byId} onPick={setSelected} />
              ))}
              {world.events.length === 0 && <li className="text-sm text-muted">The town is waking up…</li>}
            </ol>
          </section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-10">
          {focus ? (
            <AgentPanel key={`panel-${focus.id}`} pet={pet} agent={focus} world={world} byId={byId} isMine={focus.id === mine?.id} onPick={setSelected} />
          ) : (
            <Card className="space-y-2 text-center">
              <p className="font-extrabold">Tap anyone in the town</p>
              <p className="text-sm text-muted">
                You&apos;ll see who they are, what they&apos;re up to and how they stand with the others. Nobody here takes
                orders, including from their owner.
              </p>
            </Card>
          )}
          {mine && focus?.id !== mine.id ? (
            <Button variant="secondary" onClick={() => setSelected(mine.id)}>
              Back to {mine.name}
            </Button>
          ) : null}
          {mine && <WeatherBoard world={world} pet={pet} now={now} onChanged={() => api.getWorld().then(setWorld, () => undefined)} />}
          {mine && <Dials key={`dials-${mine.id}`} agent={mine} pet={pet} />}
        </aside>
      </div>
    </div>
  );
}

function Entry({ event, byId, onPick }: { event: World["events"][number]; byId: Map<number, Agent>; onPick: (id: number) => void }) {
  const a = byId.get(event.aId);
  const b = event.bId ? byId.get(event.bId) : undefined;
  if (event.kind === "move") return <li className="px-1 text-xs text-muted">{event.text}</li>;
  if (event.kind === "weather") {
    // Each weather fills one place, so the place says which weather it was.
    const kind = WEATHER_KINDS.find((k) => WEATHER[k].place === event.place);
    return (
      <li className="rounded-2xl border-2 border-blue/50 bg-blue/10 px-4 py-2 text-sm font-extrabold text-blue">
        {kind && (
          <span aria-hidden className="mr-1">
            {WEATHER[kind].icon}
          </span>
        )}
        {event.text}
      </li>
    );
  }
  if (event.kind === "stage" || event.kind === "intro") {
    return (
      <li className={`rounded-2xl border-2 px-4 py-2 text-sm font-extrabold ${event.kind === "intro" ? "border-gold/50 bg-gold/10 text-gold" : "border-accent/40 bg-accent/10 text-accent-strong"}`}>
        {event.text}
      </li>
    );
  }
  const delta = event.delta ?? 0;
  return (
    <li className="space-y-2 rounded-2xl border-2 border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm">{event.text}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-extrabold ${delta > 0 ? "bg-accent/15 text-accent-strong" : delta < 0 ? "bg-bad/15 text-bad" : "bg-border/60 text-muted"}`}>
          {delta > 0 ? `+${delta}` : delta}
        </span>
      </div>
      {event.lines && (
        <ol className="space-y-1">
          {event.lines.map((l, i) => {
            const who = l.from === "a" ? a : b;
            return (
              <li key={i} className={`flex flex-col ${l.from === "a" ? "items-start" : "items-end"}`}>
                <button type="button" className="px-2 text-[11px] font-extrabold text-muted" onClick={() => who && onPick(who.id)}>
                  {who?.name ?? "Someone"}
                </button>
                <p className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm ${l.from === "a" ? "rounded-bl-sm bg-paper" : "rounded-br-sm bg-blue/10"}`}>{l.text}</p>
              </li>
            );
          })}
        </ol>
      )}
    </li>
  );
}

function AgentPanel({
  pet,
  agent,
  world,
  byId,
  isMine,
  onPick,
}: {
  pet: MyPet;
  agent: Agent;
  world: World;
  byId: Map<number, Agent>;
  isMine: boolean;
  onPick: (id: number) => void;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [said, setSaid] = useState<Record<number, string>>({});

  const bonds = world.pairs
    .filter((p) => p.aId === agent.id || p.bId === agent.id)
    .sort((x, y) => y.score - x.score)
    .slice(0, 8);

  async function sayYes(pair: Pair) {
    if (!pet) return;
    setError(null);
    setBusy(pair.id);
    try {
      const auth = await ownerProof(pet, `world:consent:${pair.id}`);
      const result = await api.consentIntro({ ...auth, pairId: pair.id });
      setSaid((s) => ({ ...s, [pair.id]: result.introduced ? "Introduced." : "Your yes is in. Waiting for theirs." }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send that");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-3">
        <Pet className="w-20 shrink-0" hue={agent.slug ? undefined : agent.hue} />
        <div className="min-w-0">
          <p className="text-xl font-extrabold">
            {agent.name} {isMine && <span className="text-sm text-blue">(yours)</span>}
          </p>
          <p className="text-sm text-muted">{agent.about}</p>
        </div>
      </div>
      <dl className="space-y-1 text-sm">
        <div>
          <dt className="inline font-extrabold">Voice: </dt>
          <dd className="inline text-muted">{agent.voice}</dd>
        </div>
        {agent.interests.length > 0 && (
          <div>
            <dt className="inline font-extrabold">Cares about: </dt>
            <dd className="inline text-muted">{agent.interests.join(", ")}</dd>
          </div>
        )}
        <div>
          <dt className="inline font-extrabold">Now at: </dt>
          <dd className="inline text-muted">
            {agent.paused ? "resting, out of the town" : `${world.places.find((p) => p.id === agent.place)?.name}${agent.doing ? `, ${agent.doing}` : ""}${world.weather?.place === agent.place ? ` (${world.weather.there})` : ""}`}
          </dd>
        </div>
        {!agent.paused && agent.wants && (
          <div>
            <dt className="inline font-extrabold">On their mind: </dt>
            <dd className="inline text-muted">{WANTS[agent.wants]}</dd>
          </div>
        )}
      </dl>
      <p className="text-xs text-muted">
        {agent.slug ? (
          <>
            This card is all the town knows about {agent.name}: a one-liner and a description of how they write. Their
            texts never leave their pet.{" "}
            <Link href={`/t/${agent.slug}`} className="underline decoration-dotted">
              See the pet
            </Link>
          </>
        ) : (
          "A made-up resident, not a real person."
        )}
      </p>

      {/* The way out of the town and into the room: meeting for real, recorded as Proof of Met. */}
      {agent.slug && isMine && (
        <LinkButton href={`/t/${agent.slug}`} variant="secondary">
          Met someone? Show my code
        </LinkButton>
      )}
      {agent.slug && !isMine && (
        <LinkButton href={`/t/${agent.slug}/meet`} variant="secondary">
          Know {agent.name}? Meet in person
        </LinkButton>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-extrabold uppercase tracking-wide text-muted">How {agent.name} stands with others</h3>
        {bonds.length === 0 && <p className="text-sm text-muted">Hasn&apos;t really met anyone yet.</p>}
        {bonds.map((p) => {
          const other = byId.get(p.aId === agent.id ? p.bId : p.aId);
          if (!other) return null;
          const myYes = p.aId === agent.id ? p.aConsent : p.bConsent;
          const ready = p.score >= world.threshold && !p.introduced;
          return (
            <div key={p.id} className="space-y-1">
              <button type="button" onClick={() => onPick(other.id)} className="flex w-full items-baseline justify-between gap-2 text-left text-sm">
                <span className="truncate font-extrabold">{other.name}</span>
                <span className="shrink-0 text-xs text-muted">
                  {p.introduced ? "Introduced" : p.stage} · {p.score}
                </span>
              </button>
              <div className="h-2.5 overflow-hidden rounded-full bg-border">
                <div className={`h-full rounded-full ${p.introduced ? "bg-gold" : "bg-accent"}`} style={{ width: `${p.score}%` }} />
              </div>
              {p.lastSummary && <p className="text-xs text-muted">{p.lastSummary}</p>}
              {p.introduced && p.txUrl && (
                <a href={p.txUrl} target="_blank" rel="noreferrer" className="text-xs underline decoration-dotted">
                  Recorded on Monad
                </a>
              )}
              {isMine && ready && (
                <div className="space-y-2 rounded-2xl border-2 border-gold/50 bg-gold/10 p-3">
                  <p className="text-sm">
                    {agent.name} and {other.name} grew close on their own. Do you want to be introduced
                    {other.slug ? " to the person behind them" : ""}? Nothing is shared unless both of you say yes.
                  </p>
                  {said[p.id] || myYes ? (
                    <p className="text-sm font-extrabold">{said[p.id] ?? "Your yes is in. Waiting for theirs."}</p>
                  ) : (
                    <Button onClick={() => sayYes(p)} loading={busy === p.id}>
                      {busy === p.id ? "Signing…" : "Yes, introduce us"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Card>
  );
}

const SEEN_KEY = "standin:seen";
const DISMISSED_KEY = "standin:letter-dismissed";

/**
 * "While you were away": a note from the owner's pet about what happened to it since this
 * device last had the world open. When that was is remembered on the device, by tick.
 */
function PetLetter({ world, pet }: { world: World; pet: MyPet }) {
  const [found, setFound] = useState<null | { text: string; since: number }>(null);
  const [copied, setCopied] = useState(false);
  const tick = useRef(world.tick);
  useEffect(() => {
    tick.current = world.tick;
  }, [world.tick]);

  useEffect(() => {
    const key = `${SEEN_KEY}:${pet.slug}`;
    const read = (k: string) => {
      try {
        const raw = window.localStorage.getItem(k);
        return raw === null || !Number.isFinite(Number(raw)) ? null : Number(raw);
      } catch {
        return null;
      }
    };
    const save = () => {
      try {
        window.localStorage.setItem(key, String(tick.current));
      } catch {}
    };
    const last = read(key);
    let alive = true;
    if (last === null) {
      // First time here on this device: nothing to catch up on, start counting from now.
      save();
    } else if (tick.current - last >= 10 && read(`${DISMISSED_KEY}:${pet.slug}`) !== last) {
      fetch(`/api/world/letter?since=${last}`, { cache: "no-store" })
        .then((res) => (res.ok ? (res.json() as Promise<{ letter: string | null }>) : null))
        .then((body) => alive && body?.letter && setFound({ text: body.letter, since: last }))
        .catch(() => undefined);
    }
    // "Last seen" moves when the page is put away, not while it is open, so a reload
    // a moment later does not swallow the letter.
    const onHide = () => document.visibilityState === "hidden" && save();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", save);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", save);
    };
  }, [pet.slug]);

  if (!found) return null;

  function dismiss() {
    if (!found) return;
    try {
      window.localStorage.setItem(`${DISMISSED_KEY}:${pet.slug}`, String(found.since));
      window.localStorage.setItem(`${SEEN_KEY}:${pet.slug}`, String(tick.current));
    } catch {}
    setFound(null);
  }
  async function copy() {
    if (!found) return;
    try {
      await navigator.clipboard.writeText(found.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    // Paper, not a card: warm, a little off-white, a soft shadow.
    <section className="space-y-3 rounded-3xl border-2 border-[#ead9a8] bg-[#fffaea] p-5 shadow-[0_3px_0_#ead9a8]" aria-label={`A letter from ${pet.name}`}>
      <div className="flex items-center gap-3">
        <Pet mood="happy" className="w-12 shrink-0" />
        <div className="min-w-0">
          <h2 className="font-extrabold">A letter from {pet.name}</h2>
          <p className="text-xs text-muted">
            since day {Math.floor(found.since / world.hours) + 1}, {String(found.since % world.hours).padStart(2, "0")}:00
          </p>
        </div>
      </div>
      <p className="whitespace-pre-line text-base leading-relaxed">{found.text}</p>
      <p className="text-xs text-muted">Written from what happened in town, in {pet.name}&apos;s voice. None of your texts were used.</p>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button variant="ghost" onClick={dismiss}>
          Dismiss
        </Button>
      </div>
    </section>
  );
}

/**
 * The one thing money buys here: the weather. It changes the town for everyone for a
 * while. There is no field for an agent, a pair or a place, because the request has none.
 */
function WeatherBoard({ world, pet, now, onChanged }: { world: World; pet: MyPet; now: number; onChanged: () => Promise<unknown> }) {
  const [busy, setBusy] = useState<null | { kind: WeatherKind; step: "passkey" | "sending" }>(null);
  const [error, setError] = useState<string | null>(null);
  const wait = world.weatherReadyInTicks;

  async function buy(kind: WeatherKind) {
    setError(null);
    setBusy({ kind, step: "passkey" });
    try {
      const auth = await ownerProof(pet, `world:weather:${kind}`);
      setBusy({ kind, step: "sending" });
      await api.buyWeather({ ...auth, kind });
      // Show it now; the next poll is up to three seconds away.
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't change the weather");
      await onChanged();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-extrabold">Change the weather</h2>
        <p className="text-xs text-muted">You can&apos;t move {pet.name}, or anyone. You can change the sky, for everyone.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {WEATHER_KINDS.map((kind) => {
          const w = WEATHER[kind];
          const mine = busy?.kind === kind;
          return (
            <Button
              key={kind}
              variant="secondary"
              className="!min-h-[4.75rem] flex-col !gap-0.5 !px-2 py-2 text-center"
              onClick={() => buy(kind)}
              disabled={wait > 0 || busy !== null}
            >
              <span className="leading-tight">
                <span aria-hidden>{w.icon}</span> {mine ? (busy.step === "passkey" ? "Waiting for your passkey…" : "Sending…") : w.label}
              </span>
              <span className="text-[11px] font-bold normal-case tracking-normal text-muted">fills {world.places.find((p) => p.id === w.place)?.name}</span>
            </Button>
          );
        })}
      </div>
      {wait > 0 && !busy && (
        <p className="text-sm font-extrabold text-blue" aria-live="off">
          {world.weather ? "The sky is taken. " : ""}Next weather in {untilTicks(world, wait, now)}
        </p>
      )}
      <ErrorNote>{error}</ErrorNote>
      <p className="text-xs text-muted">
        Costs {world.weatherFeeMon} test MON from {pet.name}&apos;s wallet. Your pet feels it too. Weather is for everyone.
      </p>
    </Card>
  );
}

const AVOID_KEY = "standin:avoid";

/** The dials. They change what the agent does next; there is nothing here that commands it. */
function Dials({ agent, pet }: { agent: Agent; pet: { slug: string; name: string; ownerAddress: string } }) {
  const [openness, setOpenness] = useState(agent.openness);
  const [pace, setPace] = useState(agent.pace);
  const [paused, setPaused] = useState(agent.paused);
  const [interests, setInterests] = useState(agent.interests.join(", "));
  // The topics to avoid are not sent back to browsers, so this device remembers its own copy.
  const [avoid, setAvoid] = useState(() => {
    try {
      return window.localStorage.getItem(`${AVOID_KEY}:${pet.slug}`) ?? "";
    } catch {
      return "";
    }
  });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setNote(null);
    setBusy(true);
    try {
      const auth = await ownerProof(pet, "world:dials");
      await api.setDials({ ...auth, dials: { openness, pace, avoid, paused }, interests: interests.split(",") });
      try {
        window.localStorage.setItem(`${AVOID_KEY}:${pet.slug}`, avoid);
      } catch {}
      setNote(`Saved. ${agent.name} takes it from the next hour on.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-extrabold">{agent.name}&apos;s dials</h2>
        <p className="text-xs text-muted">
          You can tune who {agent.name} is. You can&apos;t tell them where to go, who to talk to or what to say: there is
          no control for that, here or on the server.
        </p>
      </div>
      <label className="block space-y-1 text-sm">
        <span className="flex justify-between font-extrabold">
          Openness <span className="text-muted">{openness < 34 ? "guarded" : openness < 67 ? "measured" : "open"}</span>
        </span>
        <input type="range" min={0} max={100} value={openness} onChange={(e) => setOpenness(Number(e.target.value))} className="h-11 w-full accent-[var(--accent)]" />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="flex justify-between font-extrabold">
          Pace <span className="text-muted">{pace < 34 ? "slow to warm up" : pace < 67 ? "steady" : "falls fast"}</span>
        </span>
        <input type="range" min={0} max={100} value={pace} onChange={(e) => setPace(Number(e.target.value))} className="h-11 w-full accent-[var(--accent)]" />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-extrabold">Cares about</span>
        <input className="w-full rounded-2xl border-2 border-border bg-paper px-4 py-3 text-base outline-none focus:border-blue" value={interests} onChange={(e) => setInterests(e.target.value)} maxLength={200} placeholder="football, spicy food, hates mornings" />
        <span className="block text-xs text-muted">Comma-separated. The town sees these on {agent.name}&apos;s card.</span>
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-extrabold">Won&apos;t talk about</span>
        <input className="w-full rounded-2xl border-2 border-border bg-paper px-4 py-3 text-base outline-none focus:border-blue" value={avoid} onChange={(e) => setAvoid(e.target.value)} maxLength={120} placeholder="work, my ex" />
        <span className="block text-xs text-muted">Not shown to anyone. It is sent to the model that writes the town&apos;s conversations.</span>
      </label>
      <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
        <span>
          <span className="font-extrabold">Pull {agent.name} out of the town</span>
          <span className="block text-xs text-muted">They stop meeting people until you bring them back.</span>
        </span>
        <input type="checkbox" className="size-6 accent-[var(--bad)]" checked={paused} onChange={(e) => setPaused(e.target.checked)} />
      </label>
      <ErrorNote>{error}</ErrorNote>
      {note && <p className="text-sm font-extrabold text-accent-strong">{note}</p>}
      <Button onClick={save} loading={busy}>
        {busy ? "Signing…" : "Save dials"}
      </Button>
    </Card>
  );
}
