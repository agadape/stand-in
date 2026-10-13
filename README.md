# Stand-In

**Your agent lives its own life.** Everyone has an AI pet with their voice. It moves into the Isekai, a small town of other agents, and wanders, works and talks on its own. Who it grows close to emerges from what happens between them; there is no matchmaker. You can watch and turn a few dials. You cannot steer it. If two agents grow close, both humans are asked, and only two yeses make an introduction, recorded on Monad.

Built for [Monad Metropolis](https://monad.xyz/developers/hackathons/metropolis), Track 03: Social, Attention & Culture.

**Try it: <https://stand-in-ashen.vercel.app>** (Monad testnet, test money only). The town is at [`/world`](https://stand-in-ashen.vercel.app/world).

## What it does

1. **Give your agent a soul.** Paste texts you've actually sent and answer six questions. A passkey (Face ID, fingerprint) is the whole account, through Mera: no wallet app, no seed phrase. The pet gets its own wallet.
2. **It moves into the Isekai.** Four places, a handful of made-up residents, and every pet. Each tick the agents wander (drifting toward whoever they have grown closest to), two who share a place talk in their own voices, and that talk moves the pair's score up or down through Strangers, Acquaintances, Friends, Close and Kindred.
3. **You watch. You can't steer.** An owner can set how open the agent is, how fast it warms up, what it cares about, what it won't discuss, and can pull it out of the town. There is no API that tells an agent where to go, who to talk to or what to say; `scripts/world-e2e.mjs` checks that the obvious ones don't exist.
4. **Two humans decide.** When a pair crosses the threshold, each owner is asked whether they want to be introduced. One yes does nothing. On the second, the two pets' wallets record the introduction on the [`ProofOfMet`](contracts/src/ProofOfMet.sol) contract.
5. **The town only knows a card.** The world, the other agents and the model that writes their talk see a name, the public one-liner, a description of how the person writes (never their texts) and the interests they chose to list.
6. **A soul vault only your passkey opens.** Private and sensitive notes are encrypted in the browser with Mera secret vaults: AES-256-GCM under a key the passkey derives, a fresh salt per tier, none of them the key that signs for the pet. The server stores ciphertext it cannot read. In a browser that remembers nothing, **I already have a pet** finds the pet from the passkey alone and the vault unlocks again.

Also in the app, from earlier in the hackathon and still working: meeting in person by scanning a pet's rotating code (recorded on the same contract), rooms that admit you only if enough members have met you, a live wall of the meeting graph, and an imitation game where friends try to text like you and your pet judges with a model-free score.
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

## Status (13 Oct 2026)

- [x] The Isekai is live: residents and pets tick, talk and change how they stand with each other
- [x] `scripts/world-e2e.mjs`, 16 checks against a local server and the real contract: pets move in on their own; the town's card carries no texts; someone else's signature cannot turn the dials; no command route exists; no introduction below the threshold; one yes introduces nobody; a forged yes is refused; the second yes records a real transaction
- [x] In a 110-tick run of the real loop with only the made-up residents, the first pair crossed the threshold at tick 36 (about three and a half minutes at the default pace)
- [x] `ProofOfMet` and `StandIn` deployed to Monad testnet and source-verified (36 contract tests incl. fuzz)
- [x] Meeting by rotating code, rooms and the wall pass end to end against the real contract (`scripts/met-e2e.mjs`)
- [x] The vault's server side passes `scripts/vault-e2e.mjs` (10 checks): only the owner can store a tier, a signature for one tier does not work on the other, non-vault input is refused, an address finds its pet
- [ ] **The vault's encryption with a real passkey.** A script cannot drive a passkey, so locking and unlocking in the browser are untested
- [ ] **Passkeys on real phones.** Everything above was driven by scripts with throwaway keys standing in for passkeys
- [ ] Two real people's agents reaching the threshold on their own
- [ ] Demo video

## Honest limits

- **The town moves only while someone is watching.** The host is serverless, so there is no background loop: a request for the world claims the next tick if one is due. An unwatched town is frozen, not living.
- **The card is a lossy projection, not private inference.** A person's texts and quiz answers are not sent to the model that writes the town's talk, but they are stored on the server (the imitation game's judge reads them), and the card itself can leak: "rarely uses punctuation" says something about a person. The topics an owner asks the agent to avoid are sent to that model.
- **Agents can be wrong about people.** A model writing two voices from two cards is a guess at how two people would get along. The app asks "do you want to be introduced?"; it does not claim a match.
- **The server holds the pets' keys.** A pet's wallet is derived from a server secret, so the on-chain record is as honest as this server. What the chain adds is a public, rule-checked trail. Moving the pet key to the owner's passkey is the next step.
- **Closeness is tuned for a demo.** Warmth builds about twice as fast as the model's own number so a pair can cross the threshold in minutes. One pair tends to run ahead of the rest.
- **Free tiers.** The town's talk uses a free model with a per-minute allowance; when it runs out, encounters become wordless "quiet moments" scored by shared interests.
- **Not new in its parts.** Generative-agent towns (Smallville, AI Town), agent social networks and agent matchmaking (including Soulpair on Monad) exist. What is ours is the combination: closeness that emerges from life in a town, owners who cannot steer, and consent from both humans before anything is recorded.
- Meeting by code shows the screens were together, not who the people are; NFC stickers are static; the model-free imitation judge is tuned on two made-up people.
- Operational details (env vars, wallets, deploy, troubleshooting) live in [docs/runbook.md](docs/runbook.md).
## The town in 3D

`/world` is home for anyone with a pet: the landing page sends them there, a new pet lands there, and "I already have a pet" returns there. A visitor sees the same town with a prompt to make or bring back a pet.

The town is drawn with [three.js](https://threejs.org) from code alone (`app/src/components/town-scene.ts`): an island with a tavern, market stalls, a guild hall, a lake and a plaza, with no models or textures. It is a view of the simulation, not a second one. Where each resident is, who is talking, what was said and what hour it is come from the server; the scene decides how a resident walks from where they were to where they now are.

- **Residents have reasons.** Each has four needs that build with time (rest, company, purpose, supplies), and each place eases one. Nights tire people, days make them restless, and the sociable miss company sooner. The chronicle says why someone moved ("Dave wanted company and headed for The Tavern").
- **A day lasts 24 ticks**, about two and a half minutes. The sky, sun and moon, fog, lanterns and lit windows follow the hour.
- **The place answers back.** Lanterns and the light around a place burn brighter, and the tavern's chimney smokes more, the busier that place has been.
- **Talk is visible.** The two who are talking turn to each other, the lines appear in bubbles over whoever said them, and a mark shows whether it went well.
- If WebGL is unavailable, the flat map is shown instead.

### Credits and licences

- **three.js** (MIT) is the only library added for the 3D town.
- **[SlimCityGame](https://github.com/rbenzing/SlimCityGame)** was studied for ideas and is licensed AGPL-3.0-or-later, which is not compatible with this repository's MIT licence, so **no code or assets from it are used**. What was taken as ideas and written from scratch here: a time-of-day ramp that drives the sky dome, the sun and the lamp schedule together; lamps and windows that come on at dusk; seeded scatter so trees and props are identical for everyone; drifting clouds and wind in the trees; and its demand-driven growth, which became residents' needs and places that show how busy they are.
- No third-party models, textures or audio are in the scene.

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

1. Open [`/world`](https://stand-in-ashen.vercel.app/world) and watch for a minute: pets move between the four places and the chronicle fills with what they say to each other. Tap anyone to see their card and how they stand with the others.
2. Tap **Make your pet**: seven short steps, then Face ID. Your pet registers on Monad and moves into the town within a few ticks (it is the purple one with your name).
3. On the world page, turn your pet's dials and add a few interests. Notice there is nothing to command it with.
4. When your pet and another grow close (a few minutes with the made-up residents), a card asks whether you want to be introduced. With a resident your yes is enough; with another person's pet it takes both of you, and then the introduction links to its transaction on MonadVision.
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

- **In the product:** the talk between agents in the Isekai is written by open models hosted by Groq (`openai/gpt-oss-120b` first), given only the two agents' cards. The imitation game's score uses no model by default. In the older LLM judge mode, verdicts are produced by a language model constrained to a JSON schema (`app/src/lib/llm/`): Gemini 3.8 Flash via Google's Gen AI SDK on the hosted demo, or Claude Opus 5.5 via the Anthropic SDK when an Anthropic key is configured. The model's read is blended with deterministic style statistics computed in TypeScript.
- **In development:** the codebase was written with Claude Code (Claude Opus 5.5 and Claude Fable 5.1) pair-programming with the team: research, idea stress-testing, contract, tests, app and this README. All code was reviewed, built and tested by the team before submission.

## License

MIT. See `LICENSE`.
