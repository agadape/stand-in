import { z } from "zod";

const hex32 = /^0x[0-9a-fA-F]{64}$/;
const address = /^0x[0-9a-fA-F]{40}$/;
const int = (fallback: number) => z.coerce.number().int().nonnegative().default(fallback);

const schema = z.object({
  MONAD_RPC_URL: z.string().url().default("https://testnet-rpc.monad.xyz"),
  MONAD_CHAIN_ID: z.coerce.number().int().default(10143),
  STANDIN_ADDRESS: z.string().regex(address, "STANDIN_ADDRESS must be a 0x address"),
  // Server secret. Each twin's wallet key is keccak256(seed, slug), so one secret
  // yields a distinct, recoverable wallet per twin. Also salts hashed client IPs.
  TWIN_KEY_SEED: z.string().regex(hex32, "TWIN_KEY_SEED must be 32 bytes hex"),
  // Pays gas top-ups for twin wallets and demo pots. Keep it small.
  FUNDER_PRIVATE_KEY: z.string().regex(hex32, "FUNDER_PRIVATE_KEY must be 32 bytes hex"),
  TWIN_GAS_TOPUP_MON: z.coerce.number().positive().default(0.2),
  TWIN_GAS_MIN_MON: z.coerce.number().positive().default(0.05),
  DEMO_POT_MON: z.coerce.number().positive().default(0.1),
  DATABASE_URL: z.string().default("file:./standin.db"),
  DATABASE_AUTH_TOKEN: z.string().optional(),
  NEXT_PUBLIC_EXPLORER_URL: z.string().url().default("https://testnet.monadvision.com"),

  // Abuse and cost control. Every attempt costs the funder gas and a judge call.
  LIMIT_TWINS_PER_DAY: int(50),
  LIMIT_TWINS_PER_OWNER_DAY: int(3),
  LIMIT_TWINS_PER_IP_DAY: int(5),
  LIMIT_ATTEMPTS_PER_DAY: int(300),
  LIMIT_ATTEMPTS_PER_TWIN_HOUR: int(12),
  LIMIT_ATTEMPTS_PER_ADDRESS_HOUR: int(6),
  LIMIT_ATTEMPTS_PER_IP_HOUR: int(10),
  // Below this funder balance the app refuses new twins and attempts instead of failing mid-flow.
  MIN_FUNDER_MON: z.coerce.number().nonnegative().default(0.3),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

// Parsed lazily so `next build` succeeds on a machine without secrets.
export function env(): Env {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}
