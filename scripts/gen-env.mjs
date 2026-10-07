// Creates app/.env.local with fresh server keys if it doesn't exist, and prints the
// funder address so you can top it up at https://faucet.monad.xyz.
// Run from the repo root: node scripts/gen-env.mjs
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, "app/.env.local");
const require = createRequire(join(root, "app/package.json"));
const { privateKeyToAccount } = require("viem/accounts");

const hex = () => `0x${randomBytes(32).toString("hex")}`;

if (!existsSync(envPath)) {
  const example = readFileSync(join(root, "app/.env.example"), "utf8");
  const filled = example
    .replace(/^TWIN_KEY_SEED=.*$/m, `TWIN_KEY_SEED=${hex()}`)
    .replace(/^FUNDER_PRIVATE_KEY=.*$/m, `FUNDER_PRIVATE_KEY=${hex()}`);
  writeFileSync(envPath, filled);
  console.log(`wrote ${envPath}`);
} else {
  console.log(`${envPath} already exists; leaving it alone`);
}

const env = readFileSync(envPath, "utf8");
const funder = env.match(/^FUNDER_PRIVATE_KEY=(0x[0-9a-fA-F]{64})/m)?.[1];
const anthropic = env.match(/^ANTHROPIC_API_KEY=(.+)$/m)?.[1]?.trim();
const contract = env.match(/^STANDIN_ADDRESS=(0x[0-9a-fA-F]{40})/m)?.[1];

if (funder) {
  console.log(`\nFunder address: ${privateKeyToAccount(funder).address}`);
  console.log("Send it testnet MON: https://faucet.monad.xyz (it pays twin gas and demo pots)");
}
if (!anthropic) console.log("\nStill needed: ANTHROPIC_API_KEY (or `ant auth login`)");
if (!contract || /^0x0{40}$/.test(contract)) {
  console.log("Still needed: STANDIN_ADDRESS. Deploy with:");
  console.log("  cd contracts && DEPLOYER_PRIVATE_KEY=<funded key> forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast");
}
