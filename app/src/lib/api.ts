/**
 * Typed client for the app's own API routes. Mirrors the JSON shapes returned under
 * src/app/api; keep the two in step.
 */

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

export type AttemptResult = {
  id: number;
  mode: "owner" | "challenger";
  scoreBps: number;
  ownerScoreBps: number;
  passed: boolean;
  paidWei: string;
  llm: {
    answers: { scenarioId: string; score: number; tell: string }[];
    overall: number;
    verdictLine: string;
  };
  styleNotes: string[];
  styleSimilarity: number;
  verdictHash: string;
  txHash: string;
  txUrl: string;
};

export type OwnerProof = { issuedAt: number; signature: string };

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
