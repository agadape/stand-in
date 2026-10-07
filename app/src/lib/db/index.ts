import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { env } from "../env";
import * as schema from "./schema";

let instance: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function db() {
  if (!instance) {
    const client = createClient({ url: env().DATABASE_URL, authToken: env().DATABASE_AUTH_TOKEN });
    instance = drizzle(client, { schema });
  }
  return instance;
}

export { schema };
