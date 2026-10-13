/**
 * Typed client for the app's own API routes. Mirrors the JSON shapes returned under
 * src/app/api; keep the two in step.
 */

export type { WatchWorld, World } from "./world";
import type { WeatherKind } from "./weather";
import type { WatchWorld, World } from "./world";

/** What the world page draws: a resident's world, or the public one with its private fields missing. */
export type WorldLike = Omit<World, "agents" | "pairs"> & {
  agents: (WatchWorld["agents"][number] & { ownerAddress?: string | null })[];
  pairs: (WatchWorld["pairs"][number] & { aConsent?: boolean; bConsent?: boolean })[];
};

export type TwinCard = {
  slug: string;
  name: string;
  bio: string;
  ownerAddress: string;
  twinAddress: string;
  twinExplorerUrl: string;
  chainTwinId: number;
  ownerProven: boolean;
  ownerScoreBps: number;
  bestScoreBps: number;
  bestChallenger: string;
  attempts: number;
  potWei: string;
  createdAt: number;
};

export type LeaderboardRow = {
  id: number;
  mode: "owner" | "challenger";
  displayName: string;
  address: string;
  scoreBps: number;
  passed: boolean;
  verdictLine: string;
  paidWei: string;
  txUrl: string;
  createdAt: number;
};

export type Scenario = { id: string; prompt: string };

export type LlmVerdict = {
  answers: { scenarioId: string; score: number; tell: string }[];
  overall: number;
  verdictLine: string;
};

export type AttemptResult = {
  id: number;
  mode: "owner" | "challenger";
  scoreBps: number;
  ownerScoreBps: number;
  passed: boolean;
  paidWei: string;
  llm: LlmVerdict;
  styleNotes: string[];
  styleSimilarity: number;
  verdictHash: string;
  judgeModel: string | null;
  txHash: string;
  txUrl: string;
};

/** Full public record of an attempt, as served by GET /api/attempts/[id]. */
export type AttemptRecord = {
  id: number;
  mode: "owner" | "challenger";
  displayName: string;
  address: string;
  scoreBps: number;
  passed: boolean;
  paidWei: string;
  txHash: string;
  txUrl: string;
  verdictHash: string;
  judgeModel: string | null;
  scenarioIds: string[];
  scenarios: Scenario[];
  answers: string[];
  llm: LlmVerdict;
  similarity: number;
  styleNotes: string[];
  createdAt: number;
  twin: { slug: string; name: string; chainTwinId: number; twinAddress: string; ownerScoreBps: number };
};

export type OwnerProof = { issuedAt: number; signature: string };

/** A pet named by slug, with its owner's passkey proof for one action. */
export type OwnerInput = { slug: string; address: string; proof: OwnerProof };

/** One rotating code: when it goes on screen (seconds), its one-time number, the pet's signature. */
export type MeetCode = { issuedAt: number; nonce: string; signature: string };

export type JoinStatus = { ok: boolean; member: boolean; vouches: number; needed: number };

export type CreateTwinInput = {
  name: string;
  bio: string;
  ownerAddress: string;
  samples: string[];
  quiz: { question: string; answer: string }[];
};

export type AttemptInput = {
  mode: "owner" | "challenger";
  address: string;
  displayName: string;
  scenarioIds: string[];
  answers: string[];
  proof?: OwnerProof;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof body.error === "string" ? body.error : `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }
  return body as T;
}

export const api = {
  createTwin: (input: CreateTwinInput) =>
    request<{ slug: string; twinAddress: string; chainTwinId: number; txHash: string }>("/api/twins", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  getTwin: (slug: string) =>
    request<{ twin: TwinCard; leaderboard: LeaderboardRow[] }>(`/api/twins/${slug}`, { cache: "no-store" }),

  getScenarios: (slug: string) =>
    request<{ scenarios: Scenario[] }>(`/api/twins/${slug}/scenarios`, { cache: "no-store" }),

  submitAttempt: (slug: string, input: AttemptInput) =>
    request<{ attempt: AttemptResult }>(`/api/twins/${slug}/attempts`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  fundPot: (slug: string, input: { address: string; proof: OwnerProof }) =>
    request<{ txHash: string; txUrl: string; potWei: string }>(`/api/twins/${slug}/pot`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  /** `from`'s owner befriends `to`; `done` is true once both said yes and the pets have talked. */
  acceptBond: (input: { from: string; to: string; address: string; proof: OwnerProof; code?: MeetCode; gatheringId?: number }) =>
    request<{ bond: { id: number; done: boolean } }>("/api/bonds", { method: "POST", body: JSON.stringify(input) }),

  /** Owner-only: ten minutes of rotating codes, each shown for `shownMs`. */
  getCodes: (slug: string, input: { address: string; proof: OwnerProof; gatheringId?: number }) =>
    request<{ codes: MeetCode[]; shownMs: number; gathering: { id: number; name: string } | null }>(
      `/api/twins/${slug}/codes`,
      { method: "POST", body: JSON.stringify(input) },
    ),

  createRoom: (input: OwnerInput & { name: string; threshold: number; inPersonOnly: boolean }) =>
    request<{ id: number }>("/api/rooms", { method: "POST", body: JSON.stringify(input) }),

  checkRoom: (id: number, slug: string) =>
    request<JoinStatus>(`/api/rooms/${id}/join?slug=${encodeURIComponent(slug)}`, { cache: "no-store" }),

  joinRoom: (id: number, input: OwnerInput) =>
    request<{ txUrl: string }>(`/api/rooms/${id}/join`, { method: "POST", body: JSON.stringify(input) }),

  createGathering: (input: OwnerInput & { name: string; hours: number }) =>
    request<{ id: number }>("/api/gatherings", { method: "POST", body: JSON.stringify(input) }),

  /** The Isekai. Asking for it also advances it when a tick is due. */
  getWorld: () => request<World>("/api/world", { cache: "no-store" }),

  /** The town for someone not signed in: read-only, without owners or half-given consent. */
  getWatch: () => request<WatchWorld>("/api/world/watch", { cache: "no-store" }),

  setDials: (input: OwnerInput & { dials: { openness: number; pace: number; avoid: string; paused: boolean }; interests: string[] }) =>
    request<{ dials: { openness: number; pace: number; avoid: string; paused: boolean } }>("/api/world/dials", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  consentIntro: (input: OwnerInput & { pairId: number }) =>
    request<{ introduced: boolean; aConsent: boolean; bConsent: boolean }>("/api/world/consent", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  /** Pays for weather from the pet wallet. The body names the weather and nothing else. */
  buyWeather: (input: OwnerInput & { kind: WeatherKind }) =>
    request<{ kind: WeatherKind; untilTick: number; txHash: string; txUrl: string }>("/api/world/weather", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  getAttempt: (id: number) => request<{ attempt: AttemptRecord }>(`/api/attempts/${id}`, { cache: "no-store" }),
};

/** 0..10000 basis points to a display percentage with one decimal. */
export function pct(bps: number) {
  return `${(bps / 100).toFixed(1)}%`;
}

export function formatMon(wei: string | bigint) {
  const n = typeof wei === "bigint" ? wei : BigInt(wei || "0");
  const whole = n / 10n ** 18n;
  const frac = (n % 10n ** 18n).toString().padStart(18, "0").slice(0, 4).replace(/0+$/, "");
  return frac ? `${whole}.${frac} MON` : `${whole} MON`;
}
