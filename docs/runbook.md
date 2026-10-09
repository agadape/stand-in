# Stand-In runbook

Operations notes for the team: environment, wallets, deploying, testing, and the failures we have already met. Product and architecture are in the [README](../README.md).

## Environment

All runtime configuration lives in `app/.env.local` (never committed). `node scripts/gen-env.mjs` creates it from `app/.env.example` with fresh keys.

| Variable | Purpose | Default |
|---|---|---|
| `GEMINI_API_KEY` | Judge model key. Free tier at <https://aistudio.google.com/apikey> (Flash models only; ~5–15 requests/min). | — |
| `GEMINI_MODEL` | Ordered, comma-separated fallback chain. The first model judges; the next is tried when one is overloaded, rate-limited or slow. | `gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash` |
| `GEMINI_THINKING` | `low`, `medium` or `high`. `low` cut verdict time from ~30 s to ~10 s with no visible loss in tells. | `low` |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Alternative judge (Claude). Used automatically when the key is set. | `claude-opus-5-5` |
| `LLM_PROVIDER` | `auto` (Anthropic if its key is set, else Gemini), `gemini`, or `anthropic` | `auto` |
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
| `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_MONAD_RPC_URL` | Used by the browser for the "Verify on Monad" button | testnet |
| `LIMIT_TWINS_PER_DAY` / `_PER_OWNER_DAY` / `_PER_IP_DAY` | Ceilings on twin creation (global, per owner address, per hashed IP) | 50 / 3 / 5 |
| `LIMIT_ATTEMPTS_PER_DAY` / `_PER_TWIN_HOUR` / `_PER_ADDRESS_HOUR` / `_PER_IP_HOUR` | Ceilings on attempts | 300 / 12 / 6 / 10 |
| `MIN_FUNDER_MON` | Below this funder balance the app refuses new twins and attempts (503) rather than failing mid-flow | `0.3` |

The dev server reloads `.env.local` on change; no restart needed.

## Monitoring

`GET /api/health` returns `{ ok, chainId, contract, funder: { address, balanceMon, ok }, db: { ok, twins, attempts } }` and responds **503** when the funder is below `MIN_FUNDER_MON` or the database is unreachable. Point an uptime checker at it before any public demo; the funder running dry is the most likely failure during judging.

Players hitting a ceiling see a plain-English message with HTTP 429 (per-twin, per-address, per-IP limits) or 503 (global daily limits, funder out of gas). Raise the `LIMIT_*` values for an event, then lower them again.

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

## Production database (Turso)

The schema is SQLite, so production uses Turso (hosted libsql), provisioned through the Vercel Marketplace on the free **Starter** plan ($0, no payment method). That route needs no Turso account or CLI (the Turso CLI has no native Windows build; it needs WSL) and Vercel injects the credentials into the project itself.

One-time setup, from the repo root:

```bash
# 1. A person accepts Turso's marketplace terms in the browser (the CLI prints the link):
vercel integration add tursocloud/database --plan starter --name standin -m region=iad1 --no-claim --no-env-pull
# 2. Re-run the same command after accepting; it creates the database and connects it to
#    the project as TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in every environment.
# 3. Create the tables:
vercel env pull .env.turso --environment development --yes
node scripts/db-push.mjs --env .env.turso
rm .env.turso
```

The app reads `DATABASE_URL` / `DATABASE_AUTH_TOKEN` first and falls back to the `TURSO_*` names (`app/src/lib/env.ts`), so production uses Turso while `app/.env.local` keeps local dev on `file:./standin.db`. Region `iad1` matches where the Vercel functions run. Re-run step 3 after every schema change. `vercel integration open tursocloud` opens the Turso dashboard through Vercel SSO.

To share one database across the team in local dev, copy the two `TURSO_*` values into `app/.env.local` as `DATABASE_URL` and `DATABASE_AUTH_TOKEN`.

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

`e2e.mjs` is both the smoke test and the judge calibration probe. It creates a twin ("Dave") with throwaway keys, signs the owner proof the same way the browser does, then plays three voices against it and prints scores, tells, style evidence, the judging model and transaction links:

| Voice | What it is | First measured (Gemini, 8 Oct) |
|---|---|---|
| owner | Dave answering as himself | 87.0% (model 92, style 78%) |
| friend | a decent imitation that overdoes his tics | 53.3% (model 64, style 33%) |
| impostor | polite email voice | 5.9% (model 2, style 13%) |

It exits non-zero unless owner > friend > impostor, so run it after any change to the prompt, the style weights or the model chain. It costs three judge calls and about 0.35 testnet MON, and retries by itself when the judge returns 503.

`npx tsx src/lib/style.check.ts` (from `app/`, also in CI) asserts the style fingerprint's invariants without any network: no high floor for unrelated voices, and no claim about how someone writes "I" unless both sides wrote it.

The repo's CI (`.github/workflows/ci.yml`) runs `forge test`, `tsc` and `eslint` on every push.

## Troubleshooting

**"Signer had insufficient balance" from a twin wallet that clearly has MON.** Monad's consensus checks balances against execution state 3 blocks behind the tip, so a wallet funded a second ago looks empty; re-sending the identical transaction just repeats the cached rejection. The app waits 2 s after a top-up and changes the priority fee on each retry. If you see this in a new code path, route the send through `withSendRetry` in `app/src/lib/twin-wallet.ts`.

**Sourcify says `bytecode_length_mismatch`.** The on-chain code wasn't produced by `forge build`. Don't deploy with `forge script`; use `scripts/deploy.mjs` (`forge create`). To verify an existing deployment: `forge verify-contract <addr> src/StandIn.sol:StandIn --chain 10143 --verifier sourcify --verifier-url https://sourcify-api-monad.blockvision.org/ --watch` from `contracts/`.

**Passkey prompt never appears, or "This browser can't make passkeys".** Mera needs a secure context (`https://` or `localhost`) and an authenticator with the WebAuthn PRF extension: iCloud Keychain, Google Password Manager, 1Password, Windows Hello. Challengers can fall back to pasting an address; owners cannot, because their passkey signs the ownership proof.

**"Owner proof rejected".** The signature must come from the exact address stored as the twin's owner, over the message in `app/src/lib/auth.ts`, within 10 minutes of `issuedAt`. Signing in with a different passkey (another device's keychain, a different password manager) yields a different address.

**"<name> hasn't proven they're themselves yet" (HTTP 409).** Challenges are blocked until the owner has set the bar. Owner: open the twin page in the browser that created it and tap **Prove you're you**.

**Port 3000 in use.** `next dev` honours `PORT`; `.claude/launch.json` sets `autoPort` so the preview picks a free one.

**Judge errors.** "The judge is swamped" (HTTP 503) means every model in `GEMINI_MODEL` was overloaded or rate-limited. On the free tier single-model overloads ("is currently experiencing high demand") are routine, which is why there is a chain; the server log line `[judge] used <model> after: ...` shows each fallback. If the whole chain fails often, reorder it to put a quieter model first (`gemini-3.6-flash` answered in ~5 s when `3.8` took 14 s and `3.7` was down). Each attempt records the model that judged it (`judge_model`, shown on the verdict page), because a bar set by one model and a challenge judged by another is not a perfectly level comparison. `Judge declined` means the model's safety classifiers refused; `Judge returned no parsable verdict` / a Zod error means the structured output failed validation. All are logged server-side. Each verdict is roughly 1,500 input + 300 output tokens; `/api/health` shows which provider is active.

**Verify button says "Mismatch".** The stored verdict no longer hashes to what the twin posted. Either the database row was edited after the fact, or the hashed field set in `app/src/lib/judge.ts` and `app/src/components/verify-verdict.tsx` has drifted; they must list the same fields in the same order (`scenarios, answers, llm, similarity, scoreBps`).

## Changing the game

- Scenarios and the owner quiz: `app/src/lib/scenarios.ts`.
- Judge prompt and score weights (65% model, 35% style): `app/src/lib/judge.ts`.
- Countable style features and their weights: `app/src/lib/style.ts`.
- Contract rules (payout on strictly higher score, who may call what): `contracts/src/StandIn.sol`.
