// Deploys StandIn to the chain configured in app/.env.local, writes the address back
// into .env.local, and verifies the source on MonadVision (Sourcify).
//
//   node scripts/deploy.mjs
//
// Uses `forge create`, which sends the compiled artifact byte-for-byte; `forge script`
// produced bytecode Sourcify could not reproduce. Uses DEPLOYER_PRIVATE_KEY from the
// environment or .env.local, falling back to FUNDER_PRIVATE_KEY.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const contracts = join(root, "contracts");
const envPath = join(root, "app/.env.local");
if (!existsSync(envPath)) {
  console.error("app/.env.local is missing; run node scripts/gen-env.mjs first");
  process.exit(1);
}
const env = readFileSync(envPath, "utf8");
const pick = (re) => env.match(re)?.[1]?.trim();

const key =
  process.env.DEPLOYER_PRIVATE_KEY ??
  pick(/^DEPLOYER_PRIVATE_KEY=(0x[0-9a-fA-F]{64})/m) ??
  pick(/^FUNDER_PRIVATE_KEY=(0x[0-9a-fA-F]{64})/m);
if (!key) {
  console.error("No DEPLOYER_PRIVATE_KEY or FUNDER_PRIVATE_KEY found");
  process.exit(1);
}
const chainId = pick(/^MONAD_CHAIN_ID=(\d+)/m) ?? "10143";
const rpc = pick(/^MONAD_RPC_URL=(\S+)/m) ?? "https://testnet-rpc.monad.xyz";
const explorer = pick(/^NEXT_PUBLIC_EXPLORER_URL=(\S+)/m) ?? "https://testnet.monadvision.com";

console.log(`Deploying StandIn to chain ${chainId} via ${rpc}`);
const create = spawnSync(
  "forge",
  ["create", "src/StandIn.sol:StandIn", "--rpc-url", rpc, "--private-key", key, "--broadcast", "--json"],
  { cwd: contracts, encoding: "utf8" },
);
if (create.status !== 0) {
  process.stderr.write(create.stderr ?? "");
  process.exit(create.status ?? 1);
}
const json = create.stdout.match(/\{[\s\S]*\}/)?.[0];
const { deployedTo: address, transactionHash: txHash } = json ? JSON.parse(json) : {};
if (!address) {
  console.error("forge create did not report a deployed address:\n" + create.stdout);
  process.exit(1);
}

writeFileSync(envPath, env.replace(/^STANDIN_ADDRESS=.*$/m, `STANDIN_ADDRESS=${address}`));
console.log(`\nStandIn: ${address}`);
console.log(`Deploy tx: ${explorer}/tx/${txHash}`);
console.log("Wrote STANDIN_ADDRESS to app/.env.local");

console.log("\nVerifying on MonadVision (Sourcify)...");
const verify = spawnSync(
  "forge",
  [
    "verify-contract",
    address,
    "src/StandIn.sol:StandIn",
    "--chain",
    chainId,
    "--verifier",
    "sourcify",
    "--verifier-url",
    "https://sourcify-api-monad.blockvision.org/",
    "--watch",
  ],
  { cwd: contracts, stdio: "inherit" },
);
console.log(
  verify.status === 0
    ? `Verified: ${explorer}/address/${address}`
    : "Verification did not complete; the deploy is still fine. Retry with the forge verify-contract command above.",
);
