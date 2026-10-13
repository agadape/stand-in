import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { StyleFeatures } from "../style";
import type { LlmVerdict } from "../judge";

export type QuizAnswer = { question: string; answer: string };

/** Everything the twin knows about its owner. Hashed on-chain as personaHash. */
export type Persona = {
  version: 1;
  name: string;
  bio: string;
  samples: string[];
  quiz: QuizAnswer[];
};

export const twins = sqliteTable("twins", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  ownerAddress: text("owner_address").notNull(),
  twinAddress: text("twin_address").notNull(),
  chainTwinId: integer("chain_twin_id").notNull(),
  createTxHash: text("create_tx_hash").notNull(),
  persona: text("persona", { mode: "json" }).$type<Persona>().notNull(),
  personaHash: text("persona_hash").notNull(),
  ownerProven: integer("owner_proven", { mode: "boolean" }).notNull().default(false),
  ownerScoreBps: integer("owner_score_bps").notNull().default(0),
  // Salted hash of the creator's IP, for rate limits only. Never the raw address.
  ipHash: text("ip_hash"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const attempts = sqliteTable("attempts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  twinId: integer("twin_id")
    .notNull()
    .references(() => twins.id),
  mode: text("mode", { enum: ["owner", "challenger"] }).notNull(),
  address: text("address").notNull(),
  displayName: text("display_name").notNull(),
  scenarioIds: text("scenario_ids", { mode: "json" }).$type<string[]>().notNull(),
  answers: text("answers", { mode: "json" }).$type<string[]>().notNull(),
  llm: text("llm", { mode: "json" }).$type<LlmVerdict>().notNull(),
  style: text("style", { mode: "json" })
    .$type<{ persona: StyleFeatures; candidate: StyleFeatures; similarity: number; notes: string[] }>()
    .notNull(),
  scoreBps: integer("score_bps").notNull(),
  passed: integer("passed", { mode: "boolean" }).notNull(),
  verdictHash: text("verdict_hash").notNull(),
  txHash: text("tx_hash").notNull(),
  paidWei: text("paid_wei").notNull().default("0"),
  // Which model wrote the verdict; with a fallback chain it can differ per attempt.
  judgeModel: text("judge_model"),
  ipHash: text("ip_hash"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export type PetChat = { messages: { from: "a" | "b"; text: string }[]; chemistry: number; summary: string };

/**
 * Two people who met and tapped. One row per pair, ordered by twin id so (a, b) and
 * (b, a) are the same bond. It completes when both owners have accepted: their pets
 * chat once, and pet A's wallet records the bond's hash on-chain in a note to pet B.
 */
export const bonds = sqliteTable("bonds", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  aTwinId: integer("a_twin_id")
    .notNull()
    .references(() => twins.id),
  bTwinId: integer("b_twin_id")
    .notNull()
    .references(() => twins.id),
  aAccepted: integer("a_accepted", { mode: "boolean" }).notNull().default(false),
  bAccepted: integer("b_accepted", { mode: "boolean" }).notNull().default(false),
  chat: text("chat", { mode: "json" }).$type<PetChat>(),
  chatModel: text("chat_model"),
  bondHash: text("bond_hash"),
  txHash: text("tx_hash"),
  // How they met: "code" is a fresh rotating code scanned off the other phone's screen
  // (in person); "link" is the static link or an NFC sticker, which proves less.
  method: text("method", { enum: ["link", "code"] }),
  gatheringId: integer("gathering_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
});

/**
 * Codes that have been spent. A rotating code works once: the row's primary key makes a
 * second use fail even when two serverless instances race (they share no memory).
 */
export const usedCodes = sqliteTable("used_codes", {
  nonce: text("nonce").primaryKey(),
  twinId: integer("twin_id")
    .notNull()
    .references(() => twins.id),
  usedAt: integer("used_at", { mode: "timestamp_ms" }).notNull(),
});

// ------------------------------------------------------------------- the Isekai

/**
 * What the world, the other agents and the chat model get to see of someone: a lossy
 * card, never their texts or quiz answers. `voice` is a description of how they write
 * ("lowercase, very short, laughs a lot"), not samples of it.
 */
export type PersonaCard = { name: string; about: string; voice: string; interests: string[] };

/** What an owner may set. These shape what the agent does next; none of them is a command. */
export type Dials = { openness: number; pace: number; avoid: string; paused: boolean };

/** What builds up in an agent over time, 0 to 100. Each place in town eases one of them. */
export type Needs = { rest: number; company: number; purpose: number; supplies: number };

/** Someone living in the world: a user's pet (twinId set) or a synthetic resident. */
export const agents = sqliteTable("world_agents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  twinId: integer("twin_id").references(() => twins.id),
  name: text("name").notNull(),
  card: text("card", { mode: "json" }).$type<PersonaCard>().notNull(),
  dials: text("dials", { mode: "json" }).$type<Dials>().notNull(),
  place: text("place").notNull(),
  needs: text("needs", { mode: "json" }).$type<Needs>(),
  // What they are up to right now, in a few words.
  doing: text("doing"),
  // Stable look for residents who have no wardrobe: a hue for the pet's body.
  hue: integer("hue").notNull().default(250),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/** How two agents stand, built up only by what happened between them. a < b by agent id. */
export const pairs = sqliteTable("world_pairs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  aId: integer("a_id")
    .notNull()
    .references(() => agents.id),
  bId: integer("b_id")
    .notNull()
    .references(() => agents.id),
  score: integer("score").notNull().default(0),
  encounters: integer("encounters").notNull().default(0),
  // The last thing that happened between them, fed back so the next talk continues it.
  lastSummary: text("last_summary"),
  // Set once they cross the threshold: each human's yes to being introduced.
  aConsent: integer("a_consent", { mode: "boolean" }).notNull().default(false),
  bConsent: integer("b_consent", { mode: "boolean" }).notNull().default(false),
  introducedAt: integer("introduced_at", { mode: "timestamp_ms" }),
  txHash: text("tx_hash"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

/** The chronicle: everything that happened, in order. */
export const events = sqliteTable("world_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tick: integer("tick").notNull(),
  kind: text("kind", { enum: ["talk", "move", "stage", "intro", "weather"] }).notNull(),
  aId: integer("a_id").notNull(),
  bId: integer("b_id"),
  place: text("place").notNull(),
  needs: text("needs", { mode: "json" }).$type<Needs>(),
  // What they are up to right now, in a few words.
  doing: text("doing"),
  text: text("text").notNull(),
  lines: text("lines", { mode: "json" }).$type<{ from: "a" | "b"; text: string }[]>(),
  delta: integer("delta"),
  // Which model wrote the talk; null when the model was unavailable and rules filled in.
  model: text("model"),
  at: integer("at", { mode: "timestamp_ms" }).notNull(),
});

/** One row: the world's clock. Claiming a tick is an UPDATE that only one request can win. */
export const worldClock = sqliteTable("world_clock", {
  id: integer("id").primaryKey(),
  tick: integer("tick").notNull().default(0),
  lastTickAt: integer("last_tick_at", { mode: "timestamp_ms" }).notNull(),
  // The weather someone paid for, if any. All null until the first purchase.
  weatherKind: text("weather_kind"),
  // The agent whose owner paid.
  weatherBy: integer("weather_by"),
  // Null while the payment is still being sent: the sky is claimed but nothing has started.
  weatherStartedTick: integer("weather_started_tick"),
  weatherUntilTick: integer("weather_until_tick"),
  weatherTx: text("weather_tx"),
});

/**
 * The soul vault: text the owner encrypted on their own device with a key derived from
 * their passkey (Mera secret vault, AES-256-GCM, a fresh PRF salt per tier). The server
 * stores the ciphertext and cannot read it. One row per pet and tier.
 */
export const soulVaults = sqliteTable("soul_vaults", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  twinId: integer("twin_id")
    .notNull()
    .references(() => twins.id),
  tier: text("tier", { enum: ["private", "sensitive"] }).notNull(),
  // The Mera vault as JSON text: credential id, PRF salt, nonce, ciphertext.
  vault: text("vault").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export type Agent = typeof agents.$inferSelect;
export type Pair = typeof pairs.$inferSelect;
export type WorldEvent = typeof events.$inferSelect;
export type Twin = typeof twins.$inferSelect;
export type Bond = typeof bonds.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
