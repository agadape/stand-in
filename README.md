# Stand-In

**You meet. Your pets talk.** Everyone has an AI pet that texts like them. Scan the code on someone's phone and your pets have their first chat, and the meeting is written to a public contract on Monad: an on-chain graph of who has actually stood next to whom, which any app can read.

Built for [Monad Metropolis](https://monad.xyz/developers/hackathons/metropolis), Track 03: Social, Attention & Culture.

**Try it: <https://stand-in-ashen.vercel.app>** (Monad testnet, test money only).

## What it does

1. **Make your pet.** Paste texts you've actually sent and answer six questions; the pet learns your voice. A passkey (Face ID, fingerprint) is the whole account: no wallet app, no seed phrase. The pet gets its own wallet.
2. **Meet someone, scan their code.** Your pet shows a QR code that changes every 20 seconds and works once. A screenshot is dead within about a minute, so holding a working code means you were looking at that phone.
3. **Your pets talk.** They have a first chat in your two voices and report how well you'd get along.
4. **Proof of Met.** The scanner's pet writes the meeting to the [`ProofOfMet`](contracts/src/ProofOfMet.sol) contract, carrying the other pet's signature over the code. The contract itself checks the signature, that the code is under 15 minutes old and unused, one record per pair, and at most 30 new friends per pet per hour.
5. **Access that follows the person.** Anyone can open a **room** with one rule: you may join if N members have met you (optionally: in person only). The contract counts and decides. **Gatherings** stamp the meetings made at an event, and the **live wall** draws the graph as it grows, read straight from the contract.
6. **The imitation game.** Answer three texts as your new friend. Their pet scores how much you sound like them, names what gave you away ("You wrote 'nggak'. Rina writes 'gak'."), and pays you a pot from its own wallet if you out-score the real person. The score is counted from writing habits with no AI model, so the same answers always get the same score.

## What other apps can read

`ProofOfMet` is deployed and source-verified on Monad testnet at [`0x3fC9…aBb7`](https://testnet.monadvision.com/address/0x3fC903947CAfdC359472119752b6540D431DaBb7).

| Function | Answers |
|---|---|
| `hasMet(a, b)` | Have these two pets met at all? |
| `hasMetInPerson(a, b)` | Did they meet by scanning a fresh code? |
| `mutualCount(a, b)` | How many pets have both of them met? |
| `vouchCount(candidate, members, inPersonOnly)` | How many of these members have met the candidate? |
| `friendsOf(pet)`, `friendCount(pet)` | A pet's friends (`friendsOf` and `mutualCount` walk the meeting list: free off-chain, linear if called from a contract) |
| `attended(gatheringId, pet)` | Did this pet meet someone at that gathering? |
| `canJoin(roomId, pet)` | Would this room let the pet in, and how many vouches is it short? |

## Status (12 Oct 2026)

- [x] `ProofOfMet` and `StandIn` deployed to Monad testnet and source-verified (36 contract tests incl. fuzz)
- [x] The whole meeting flow passes end to end against the real contract (`scripts/met-e2e.mjs`): only the owner can fetch codes, one scan of a fresh code completes a friendship, a reused or altered code is refused, a room turns away a pet with 1 of 2 vouches and admits it after one more meeting
- [x] Imitation game end to end with the model-free judge (`scripts/e2e.mjs`): owner 58% / friend imitation 45% / email-voice impostor 8%
- [ ] **Passkeys and camera scanning on real phones.** Everything above was driven by scripts with throwaway keys standing in for passkeys
- [ ] A passing challenger and live payout through the app (contract-tested only)
- [ ] A real gathering. The wall has only shown test pets
- [ ] Demo video

## Honest limits

- **The server holds the pets' keys.** A pet's wallet is derived from a server secret, so the graph is as honest as this server. What the chain adds is that the rules (freshness, single use, one record per pair, the hourly cap, room thresholds) are enforced by the contract and every record is public. Moving the pet key to the owner's passkey is the next step.
- **A fresh code shows the screens were together, not that the people are who they say.** Someone live-streaming their screen to a friend defeats it; the 30-an-hour cap bounds the damage. One person can also make several pets, so the graph counts pets, not distinct humans.
- **NFC stickers are static.** A meeting through the plain link needs both owners to accept and is recorded as a link, which in-person rooms don't count.
- **Free tiers.** The pets' chat uses a free model with a small per-minute allowance; when it runs out the meeting is still recorded and the pets "stay shy". Nothing in the meeting graph or the imitation game's score depends on a model.
- **The model-free judge is tuned on two made-up people.** It needs real players before its numbers mean much.
- Operational details (env vars, wallets, deploy, troubleshooting) live in [docs/runbook.md](docs/runbook.md).

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
