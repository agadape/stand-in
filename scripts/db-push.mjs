// Applies the Drizzle schema to the database named in app/.env.local.
// drizzle-kit reads process.env only, so this loads .env.local for it.
//
//   node scripts/db-push.mjs             # uses DATABASE_URL / DATABASE_AUTH_TOKEN from app/.env.local
//   DATABASE_URL=libsql://... DATABASE_AUTH_TOKEN=... node scripts/db-push.mjs   # explicit override
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = join(root, "app");
const envPath = join(app, ".env.local");

const fileEnv = {};
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) fileEnv[m[1]] = m[2].trim();
  }
}

const url = process.env.DATABASE_URL ?? fileEnv.DATABASE_URL ?? "file:./standin.db";
const token = process.env.DATABASE_AUTH_TOKEN ?? fileEnv.DATABASE_AUTH_TOKEN;

console.log(`Pushing schema to ${url.replace(/\/\/([^@/]+)@/, "//<redacted>@")}`);
const result = spawnSync("npx", ["drizzle-kit", "push"], {
  cwd: app,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, DATABASE_URL: url, ...(token ? { DATABASE_AUTH_TOKEN: token } : {}) },
});
process.exit(result.status ?? 1);
