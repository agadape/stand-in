import { defineConfig } from "drizzle-kit";

// Same precedence as src/lib/env.ts: explicit DATABASE_* first, then the names the
// Vercel Marketplace Turso integration injects, then a local file.
export default defineConfig({
  dialect: "turso",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "file:./standin.db",
    authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN,
  },
});
