// Applies the Drizzle schema to a database. drizzle-kit reads process.env only, so this
// loads env files for it.
//
//   node scripts/db-push.mjs                  # the DB named in app/.env.local (default: local file)
//   node scripts/db-push.mjs --env <file>     # values from another env file, e.g. one written by
//                                             # `vercel env pull <file> --environment production`
//
// Accepts DATABASE_URL / DATABASE_AUTH_TOKEN or the Vercel Marketplace names
// TURSO_DATABASE_URL / TURSO_AUTH_TOKEN. Variables already in the shell win over files.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = join(root, "app");

const flag = process.argv.indexOf("--env");
const envPath = flag > -1 ? resolve(process.argv[flag + 1] ?? "") : join(app, ".env.local");
if (flag > -1 && !existsSync(envPath)) {
  console.error(`No such env file: ${envPath}`);
  process.exit(1);
}

const fileEnv = {};
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) fileEnv[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1");
  }
}
const pick = (...names) => names.map((n) => process.env[n] || fileEnv[n]).find(Boolean);

const url = pick("DATABASE_URL", "TURSO_DATABASE_URL") ?? "file:./standin.db";
const token = pick("DATABASE_AUTH_TOKEN", "TURSO_AUTH_TOKEN");
if (url.startsWith("libsql://") && !token) {
  console.error("A libsql:// database needs DATABASE_AUTH_TOKEN (or TURSO_AUTH_TOKEN).");
  process.exit(1);
}

// No --force: if a change would drop data, drizzle-kit asks, and a person should answer.
console.log(`Pushing schema to ${url.replace(/\/\/([^@/]+)@/, "//<redacted>@")}`);
const result = spawnSync("npx", ["drizzle-kit", "push"], {
  cwd: app,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, DATABASE_URL: url, DATABASE_AUTH_TOKEN: token ?? "" },
});
process.exit(result.status ?? 1);
