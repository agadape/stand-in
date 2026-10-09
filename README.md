# Stand-In

**Be more you than you.** Your friends try to pass as you. Your AI twin decides who's real, and pays whoever pulls it off.

Built for [Monad Metropolis](https://monad.xyz/developers/hackathons/metropolis), Track 03: Social, Attention & Culture.

**Play it: <https://stand-in-ashen.vercel.app>** (Monad testnet, test money only). Try being Dave: <https://stand-in-ashen.vercel.app/t/dave-75e42b>

## Status (9 Oct 2026)

- [x] `StandIn` deployed to Monad testnet and source-verified on MonadVision: [`0x9390…16C2`](https://testnet.monadvision.com/address/0x9390ad4e2F8d61387a00CB168c58733831a416C2)
- [x] Contract tests (18, incl. fuzz), app type-check, lint and production build all green; CI runs them on every push
- [x] Chain path exercised against the real contract: twin creation by the twin's own wallet, card read back from chain
- [x] Judge path end to end on Gemini's free tier (`scripts/e2e.mjs`): owner 87% / friend imitation 53% / email-voice impostor 6%, verdicts verified against the chain in the browser
- [ ] A passing challenger and live payout through the app (contract-tested; no fixture has beaten the owner yet)
- [x] Hosted on Vercel with a Turso database (free tiers); the full loop passes against production infrastructure
- [ ] Passkey flows on real phones (Mera PRF)
- [ ] Demo video

Operational details (env vars, wallets, deploy, troubleshooting) live in [docs/runbook.md](docs/runbook.md).

## The game

1. **Make your twin.** Paste texts you've actually sent and answer six quick questions. A passkey (Face ID, fingerprint) is the whole account: no wallet app, no seed phrase.
2. **Set the bar.** Answer three texting scenarios *as yourself*. Your own score is what everyone else has to beat. (Most people score in the 60s–70s. Being yourself on demand is harder than it sounds.)
3. **Send the link.** Friends answer three scenarios the way you would. Your twin scores each answer, names the tell that sold it or gave it away, and shows countable evidence ("Dave starts 90% of texts lowercase. You: 0%.").
4. **The twin pays.** Beat the real you and the twin's own wallet sends you the pot, in the same Monad transaction as the verdict.

Nobody waits for anyone: a twin is a link, one person can play alone, and a judge can try it without a wallet.

## Why Monad is load-bearing

- **Every twin has its own wallet.** It registers itself on-chain, posts every verdict, and pays challengers. The app operator holds no admin key on the contract: `submitVerdict`, `proveOwner` and `updatePersona` are callable only by the twin's wallet, and `reclaim` only by the owner or the twin (paying the owner).
- **Verdict and payout are one transaction.** `submitVerdict` records the score and, if it beats the owner's bar, empties the pot into the challenger's wallet. Finality in well under a second makes "the twin just paid you" land while the player is still looking at the screen.
- **Verdicts are checkable.** Each verdict's `keccak256` hash is stored on-chain next to the score. Every verdict screen and every public attempt page (`/t/<slug>/a/<id>`) has a **Verify on Monad** button that refetches the stored verdict, recomputes the hash in the browser, reads the hash out of the transaction's event log directly from the RPC, and compares; the app's server is not trusted anywhere in that check.
- **Players never need gas.** Passkey accounts hold nothing and sign nothing on-chain; the twin's wallet does all the sending.

## Architecture

```
app/  Next.js 16, TypeScript, Tailwind v4
 ├─ src/components        create-twin, play, verdict, verify-verdict, twin-view (client components)
 ├─ src/app/api/twins     POST create · GET card+leaderboard · GET scenarios · POST attempts · POST pot
 ├─ src/app/api/attempts  GET one attempt's public record (what the verify button recomputes)
 ├─ src/app/api/health    funder gas, database and chain status for the team
 ├─ src/lib/limits.ts     per-twin / per-address / per-IP / global ceilings and a funder-gas guard
 ├─ src/lib/judge.ts      prompt, score blend and verdict hash
 ├─ src/lib/llm/          pluggable judge model: Gemini 3.8 Flash (free tier) or Claude Opus 5.5, same JSON schema
 ├─ src/lib/style.ts      countable texting habits: casing, length, emoji, punctuation, laugh/abbrev rates
 ├─ src/lib/passkey.ts    Mera (WebAuthn PRF) → EVM account → viem signer, client-side only
 ├─ src/lib/twin-wallet.ts per-twin wallet derived from a server seed + slug; gas top-ups
 ├─ src/lib/contract.ts   viem calls into StandIn.sol
 └─ src/lib/db            Drizzle + libsql (SQLite locally, Turso in prod)
contracts/  Foundry
 └─ src/StandIn.sol       twins, pots, verdicts, payouts (18 tests incl. fuzz)
scripts/    gen-env.mjs (bootstrap .env.local) · deploy.mjs (forge create + Sourcify verify) · sync-abi.mjs (contract → app ABI) · e2e.mjs (API smoke test)
docs/       runbook.md (operations and troubleshooting)
```

**Scoring.** Final score (0–10000 bps) = 65% the twin's holistic read (the judge model, JSON-schema constrained; Gemini 3.8 Flash on the hosted demo, Claude Opus 5.5 when an Anthropic key is configured) + 35% style similarity (weighted distance between the owner's and the candidate's measured habits). The LLM is told never to quote the owner's private samples in its tells, only the habits.

**Privacy.** Sample texts and quiz answers are stored server-side and sent only to the judge. The public twin card and API expose name, bio, addresses, scores and verdict lines; never the samples or other players' answers. Only the owner's passkey can create a twin for that address.

## Run it

Prerequisites: Node 20.9+, [Foundry](https://getfoundry.sh), a judge key (a free Gemini key from <https://aistudio.google.com/apikey>, or an Anthropic key), and some Monad testnet MON from <https://faucet.monad.xyz>.

```bash
# 0. forge-std is a git submodule (skip if you cloned with --recurse-submodules)
git submodule update --init --recursive

# 1. Contracts: compile and test
(cd contracts && forge test)
node scripts/sync-abi.mjs            # copies the ABI into the app (already committed; rerun after contract changes)

# 2. Keys
(cd app && npm install)
node scripts/gen-env.mjs             # writes app/.env.local with fresh TWIN_KEY_SEED and FUNDER_PRIVATE_KEY, prints the funder address
#    → fund the printed address at https://faucet.monad.xyz (it pays deploys, twin gas and demo pots)
#    → set GEMINI_API_KEY (or ANTHROPIC_API_KEY) in app/.env.local

# 3. Deploy to Monad testnet (chain 10143) and verify on MonadVision
node scripts/deploy.mjs              # forge create + Sourcify verify; writes STANDIN_ADDRESS into app/.env.local

# 4. Database and app
node scripts/db-push.mjs             # applies the schema to the DB in app/.env.local (local file, or Turso in prod)
cd app
npm run dev                          # http://localhost:3000
node ../scripts/e2e.mjs http://localhost:3000   # optional: full create → prove → fund → challenge loop from the shell
```

Passkeys need a secure context (`localhost` counts) and an authenticator with the WebAuthn PRF extension: iCloud Keychain, Google Password Manager, 1Password and Windows Hello all work. Challengers without one can paste an address instead.

**Deploying the app:** any Node host works. For Vercel, point `DATABASE_URL`/`DATABASE_AUTH_TOKEN` at a Turso database and set the same env vars as `.env.local`.

## Try it as a judge

1. Open the live link, tap **Make your twin**, paste 8+ texts, answer the six questions, create with Face ID. The twin registers on Monad (first transaction, from the twin's wallet).
2. Tap **Prove you're you**, answer three scenarios as yourself. Your score is the bar (second transaction).
3. Tap **Add demo pot**, then **Copy link** and open it on another phone, or in a private window.
4. Tap **Be <name>**, answer three scenarios as them. Watch the verdict, the tells, the style evidence, and, if you beat the bar, the payout transaction from the twin's wallet.

Every verdict screen links to its transaction on MonadVision and shows the verdict hash stored there.

## Contract

`contracts/src/StandIn.sol`, Solidity 0.8.28.

**Monad testnet (chain 10143):** [`0x9390ad4e2F8d61387a00CB168c58733831a416C2`](https://testnet.monadvision.com/address/0x9390ad4e2F8d61387a00CB168c58733831a416C2) · [deploy tx](https://testnet.monadvision.com/tx/0x731ca711a18ff4967feb2bf1dbdf8d180fd3759dc14b5d114bbedf620fd00150) · source verified on Sourcify (exact match). Deployed with `node scripts/deploy.mjs`.

| Function | Who | What |
|---|---|---|
| `createTwin(owner, personaHash)` | the twin's wallet | registers the twin and names its human |
| `proveOwner(twinId, score, verdictHash)` | twin | sets the owner's bar |
| `fund(twinId)` payable | anyone | sweetens the pot |
| `submitVerdict(twinId, challenger, score, verdictHash)` | twin | records the attempt; pays the pot if `score > ownerScore` |
| `reclaim(twinId)` | owner or twin | returns the pot to the owner |
| `updatePersona(twinId, personaHash)` | twin | re-hashes the persona after an edit |

`forge test` runs 18 tests including a fuzz test that the pot pays out only on a strictly higher score.

## Notes on building for Monad

Things we hit that differ from Ethereum, and what the code does about them:

- **Gas is charged on `gas_limit`, not gas used.** Twin wallets are topped up with 0.2 MON (`TWIN_GAS_TOPUP_MON`); a `createTwin` or `submitVerdict` costs about 0.01 MON at the testnet's ~100 gwei base fee.
- **A freshly funded wallet can't send immediately.** Consensus checks the sender's balance against execution state 3 blocks behind the tip ([reserve balance](https://docs.monad.xyz/developer-essentials/reserve-balance)), so a wallet funded a second ago is rejected with "insufficient balance" even though `eth_getBalance` shows the money. Re-sending an identical transaction returns the same cached answer. `ensureGas` waits ~2 s after a top-up, and `withSendRetry` bumps the priority fee per attempt so each retry is a new transaction.
- **`forge script` bytecode didn't verify.** The bytecode `forge script` broadcast was two bytes longer than any `forge build` output, so Sourcify reported `bytecode_length_mismatch`. `scripts/deploy.mjs` uses `forge create`, which sends the compiled artifact as-is; verification then matched exactly.

## Status and honest limitations

- Runs on **Monad testnet** with test MON. Nothing here is real money.
- **Twin keys are server-derived** in this version (`keccak256(seed, slug)`), so the operator could in principle sign a verdict. The planned fix is deriving each twin's key from the owner's passkey via Mera's PRF with a per-twin salt, so the owner's device, not the server, is the twin's key source. The contract already treats the twin's wallet as the only authority.
- **Demo pots are funded by the app's funder wallet** (owner-triggered) so judges can see a payout without acquiring MON. `fund()` is open to anyone with a wallet.
- The judge is a language model. Scores are entertainment, not identity verification.
- Mera is in preview; its API may change.

## AI tool disclosure

- **In the product:** verdicts are produced by a language model constrained to a JSON schema (`app/src/lib/llm/`): Gemini 3.8 Flash via Google's Gen AI SDK on the hosted demo, or Claude Opus 5.5 via the Anthropic SDK when an Anthropic key is configured. The model's read is blended with deterministic style statistics computed in TypeScript.
- **In development:** the codebase was written with Claude Code (Claude Opus 5.5 and Claude Fable 5.1) pair-programming with the team: research, idea stress-testing, contract, tests, app and this README. All code was reviewed, built and tested by the team before submission.

## License

MIT. See `LICENSE`.
