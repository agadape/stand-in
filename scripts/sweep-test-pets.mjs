// Returns the gas left in LOCAL test pets' wallets to the funder wallet.
//
//   node scripts/sweep-test-pets.mjs
//
// Every e2e run tops up a few throwaway pets with testnet MON that then sits unused. This
// reads the pets in the local database (app/standin.db), rebuilds each wallet from the
// seed in app/.env.local, and sends what it holds back. It only ever touches pets in the
// local file, never the hosted database.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "app/package.json"));
const { createClient } = require("@libsql/client");
const { concatHex, createPublicClient, createWalletClient, formatEther, http, keccak256, parseGwei, stringToHex } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");

const env = readFileSync(join(root, "app/.env.local"), "utf8");
const pick = (name) => env.match(new RegExp(`^${name}=(\\S+)`, "m"))?.[1];
const rpc = pick("MONAD_RPC_URL") ?? "https://testnet-rpc.monad.xyz";
const chain = { id: Number(pick("MONAD_CHAIN_ID") ?? 10143), name: "Monad", nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 }, rpcUrls: { default: { http: [rpc] } } };
const funder = privateKeyToAccount(pick("FUNDER_PRIVATE_KEY")).address;
const seed = pick("TWIN_KEY_SEED");

const client = createPublicClient({ chain, transport: http(rpc) });
const db = createClient({ url: `file:${join(root, "app/standin.db")}` });
// Slugs given on the command line (test pets an e2e run made on a hosted site that shares
// this seed) are swept instead of the local database's.
const named = process.argv.slice(2).map((slug) => ({ slug }));
const { rows } = named.length ? { rows: named } : await db.execute("select slug from twins");

const GAS = 21_000n;
const maxFeePerGas = (await client.getGasPrice()) * 2n;
const cost = GAS * maxFeePerGas;
let total = 0n;

for (const { slug } of rows) {
  const account = privateKeyToAccount(keccak256(concatHex([seed, stringToHex(`standin:twin:${slug}`)])));
  const balance = await client.getBalance({ address: account.address });
  if (balance <= cost * 2n) continue;
  const value = balance - cost;
  try {
    const hash = await createWalletClient({ account, chain, transport: http(rpc) }).sendTransaction({
      to: funder,
      value,
      gas: GAS,
      maxFeePerGas,
      maxPriorityFeePerGas: parseGwei("2"),
    });
    await client.waitForTransactionReceipt({ hash });
    total += value;
    console.log(`${slug.padEnd(16)} ${formatEther(value)} MON`);
  } catch (error) {
    console.log(`${slug.padEnd(16)} skipped: ${String(error.shortMessage ?? error.message).slice(0, 80)}`);
  }
}
console.log(`\nreturned ${formatEther(total)} MON; funder now holds ${formatEther(await client.getBalance({ address: funder }))} MON`);
