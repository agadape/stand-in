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
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
});

export type Twin = typeof twins.$inferSelect;
export type Bond = typeof bonds.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
