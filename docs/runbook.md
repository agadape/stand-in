# Stand-In runbook

Operations notes for the team: environment, wallets, deploying, testing, and the failures we have already met. Product and architecture are in the [README](../README.md).

## Environment

All runtime configuration lives in `app/.env.local` (never committed). `node scripts/gen-env.mjs` creates it from `app/.env.example` with fresh keys.

| Variable | Purpose | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | The judge (Claude Opus 5.5). Alternatively sign in with `ant auth login` and leave unset. | — |
| `MONAD_RPC_URL` | JSON-RPC endpoint | `https://testnet-rpc.monad.xyz` |
| `MONAD_CHAIN_ID` | `10143` testnet, `143` mainnet | `10143` |
| `NEXT_PUBLIC_EXPLORER_URL` | Explorer base for links | `https://testnet.monadvision.com` |
| `STANDIN_ADDRESS` | Deployed `StandIn` contract; written by `scripts/deploy.mjs` | — |
| `TWIN_KEY_SEED` | 32-byte server secret; each twin's wallet key is `keccak256(seed, "standin:twin:<slug>")` | generated |
| `FUNDER_PRIVATE_KEY` | Wallet that pays deploys, twin gas top-ups and demo pots | generated |
| `TWIN_GAS_TOPUP_MON` | Sent to a twin wallet when it runs low | `0.2` |
| `TWIN_GAS_MIN_MON` | Balance below which a top-up happens before a send | `0.05` |
| `DEMO_POT_MON` | Amount the owner's "Add demo pot" button drops into the pot | `0.1` |
| `DATABASE_URL` | libsql URL: `file:./standin.db` locally, a Turso URL in production | `file:./standin.db` |
| `DATABASE_AUTH_TOKEN` | Turso token (production only) | — |

The dev server reloads `.env.local` on change; no restart needed.

## Wallets

- **Funder** `0x1Ead1fa85E3DCb934c9252bF2ee7985407CC1E99` (current team instance). Fund it at <https://faucet.monad.xyz>. It deployed the contract, tops up twins and pays demo pots. Watch it: `cast balance <addr> --rpc-url https://testnet-rpc.monad.xyz --ether`.
- **Twin wallets** are derived, never stored. Losing `TWIN_KEY_SEED` means every twin's wallet (and its on-chain authority) is lost; losing the database means the slugs are lost and the wallets are unrecoverable. Back both up before any production use.
- **Players** never hold MON. Passkey accounts (Mera) only sign a dated message for owner actions; challengers can paste any address to be paid at.

Rough costs on testnet at ~100 gwei: `createTwin` ≈ 0.01 MON, `proveOwner` / `submitVerdict` ≈ 0.01 MON, top-up 0.2 MON per new twin, demo pot 0.1 MON. One full demo (create, prove, pot, one challenge) uses about 0.35 MON of the funder's balance.

## Deploying the contract

```bash
node scripts/deploy.mjs
```

Runs `forge create src/StandIn.sol:StandIn` with the funder key (or `DEPLOYER_PRIVATE_KEY` if set), writes `STANDIN_ADDRESS` into `app/.env.local`, then verifies on MonadVision via Sourcify (`--watch`, expect `exact_match`). For mainnet set `MONAD_CHAIN_ID=143`, `MONAD_RPC_URL=https://rpc.monad.xyz`, `NEXT_PUBLIC_EXPLORER_URL=https://monadvision.com` first.

After any contract change: `forge test` in `contracts/`, then `node scripts/sync-abi.mjs` so the app's ABI matches, then redeploy.

Current testnet deployment: [`0x9390ad4e2F8d61387a00CB168c58733831a416C2`](https://testnet.monadvision.com/address/0x9390ad4e2F8d61387a00CB168c58733831a416C2).

## Running and testing

```bash
# contracts
cd contracts && forge test -vv

# app
cd app
npx drizzle-kit push        # once, or after schema changes
npm run dev
npx tsc --noEmit && npx eslint src && npm run build

# end to end against a running app (two judge calls, four transactions)
node scripts/e2e.mjs http://localhost:3000
```

`e2e.mjs` creates a twin with throwaway keys, signs the owner proof the same way the browser does, sets the bar, funds a demo pot, sends a deliberately off-voice challenger, and prints scores, tells and transaction links. It is the quickest way to check the judge prompt after changes.

The repo's CI (`.github/workflows/ci.yml`) runs `forge test`, `tsc` and `eslint` on every push.

## Troubleshooting

**"Signer had insufficient balance" from a twin wallet that clearly has MON.** Monad's consensus checks balances against execution state 3 blocks behind the tip, so a wallet funded a second ago looks empty; re-sending the identical transaction just repeats the cached rejection. The app waits 2 s after a top-up and changes the priority fee on each retry. If you see this in a new code path, route the send through `withSendRetry` in `app/src/lib/twin-wallet.ts`.

**Sourcify says `bytecode_length_mismatch`.** The on-chain code wasn't produced by `forge build`. Don't deploy with `forge script`; use `scripts/deploy.mjs` (`forge create`). To verify an existing deployment: `forge verify-contract <addr> src/StandIn.sol:StandIn --chain 10143 --verifier sourcify --verifier-url https://sourcify-api-monad.blockvision.org/ --watch` from `contracts/`.

**Passkey prompt never appears, or "This browser can't make passkeys".** Mera needs a secure context (`https://` or `localhost`) and an authenticator with the WebAuthn PRF extension: iCloud Keychain, Google Password Manager, 1Password, Windows Hello. Challengers can fall back to pasting an address; owners cannot, because their passkey signs the ownership proof.

**"Owner proof rejected".** The signature must come from the exact address stored as the twin's owner, over the message in `app/src/lib/auth.ts`, within 10 minutes of `issuedAt`. Signing in with a different passkey (another device's keychain, a different password manager) yields a different address.

**"<name> hasn't proven they're themselves yet" (HTTP 409).** Challenges are blocked until the owner has set the bar. Owner: open the twin page in the browser that created it and tap **Prove you're you**.

**Port 3000 in use.** `next dev` honours `PORT`; `.claude/launch.json` sets `autoPort` so the preview picks a free one.

**Judge errors.** `Judge declined` means Claude's safety classifiers refused; `Judge returned no parsable verdict` means the structured output failed validation. Both are logged server-side; the player sees a retryable error. Each verdict costs roughly 1,500 input + 300 output tokens.

## Changing the game

- Scenarios and the owner quiz: `app/src/lib/scenarios.ts`.
- Judge prompt and score weights (65% model, 35% style): `app/src/lib/judge.ts`.
- Countable style features and their weights: `app/src/lib/style.ts`.
- Contract rules (payout on strictly higher score, who may call what): `contracts/src/StandIn.sol`.
