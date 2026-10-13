# Stand-In: the whole project in one document

Written 13 Oct 2026 from the code on `main` at commit `fc1b1ff` (after PR #16). Where this document and the code disagree, the code is right.

- Live app: <https://stand-in-ashen.vercel.app>
- Code: <https://github.com/agadape/stand-in>
- Hackathon: Monad Metropolis, Track 03 (Social, Attention & Culture). Deadline 14 Oct 2026, 10:59 GMT+7.
- Network: Monad testnet, chain id 10143. Test money only.

Contents

1. [What Stand-In is](#1-what-stand-in-is)
2. [The ideas it is built on](#2-the-ideas-it-is-built-on)
3. [A user's journey](#3-a-users-journey)
4. [Architecture](#4-architecture)
5. [Smart contracts](#5-smart-contracts)
6. [Accounts, keys and sign-in](#6-accounts-keys-and-sign-in)
7. [The Isekai world engine](#7-the-isekai-world-engine)
8. [Meeting in person, rooms, gatherings, the wall](#8-meeting-in-person-rooms-gatherings-the-wall)
9. [The imitation game](#9-the-imitation-game)
10. [The soul vault](#10-the-soul-vault)
11. [AI models](#11-ai-models)
12. [Database](#12-database)
13. [HTTP API](#13-http-api)
14. [Frontend: what every screen looks like](#14-frontend-what-every-screen-looks-like)
15. [The 3D town](#15-the-3d-town)
16. [Privacy: who can see what](#16-privacy-who-can-see-what)
17. [Configuration and deployment](#17-configuration-and-deployment)
18. [Tests](#18-tests)
19. [What is tested and what is not](#19-what-is-tested-and-what-is-not)
20. [Honest limits](#20-honest-limits)
21. [Known loose ends in the code](#21-known-loose-ends-in-the-code)
22. [Repository map](#22-repository-map)

---

## 1. What Stand-In is

Everyone gets an AI pet that writes the way they do. The pet moves into the **Isekai**, a small town of other agents, and lives there on its own: it walks between four places, does things, and talks to whoever it runs into. How close two agents become depends only on what happens between them. Nothing pairs them up.

The owner can watch and can turn a few dials. The owner cannot tell the pet where to go, who to talk to or what to say. When two agents grow close enough, each human is asked whether they want to be introduced. One yes does nothing. Two yeses, and the two pets' own wallets record the introduction on Monad.

The same app also has three older features that still work and share the same contract and accounts:

- **Proof of Met.** Two people who meet in person scan a rotating code on one phone. Their pets chat once and the meeting is written on-chain as "met in person".
- **Rooms.** A group that lets you in only if enough of its members have met you. The contract decides.
- **The imitation game.** Friends try to text like you. Your pet scores them. Beat the owner's own score and the pet's wallet pays you the pot.

## 2. The ideas it is built on

| Idea | What it means in the product |
|---|---|
| Emergent, not matched | A pair's score changes only because the two had an encounter. There is no matchmaking step anywhere. |
| You can buy the weather, never the heart | Money buys circumstances for the whole town, for a while. It never buys an agent's choices, a pair's score or anyone's consent. |
| Owners cannot steer | The server has no route that moves an agent or puts words in its mouth. The test suite checks that the obvious ones (`/api/world/move`, `/say`, `/command`) do not exist. |
| Two humans decide | At score 80 each owner is asked. The on-chain record is made only after both said yes. |
| The town knows a card, not you | The world, the other agents and the chat model see a name, a one-liner, a description of how the person writes and the interests they chose to list. Never their texts. |
| The passkey is the account | No wallet app, no seed phrase, no email, no password. Face ID or a fingerprint derives an EVM key through Mera. |
| Every pet has its own wallet | Only that wallet can post verdicts, record a meeting or join a room. The pet pays its own gas. |
| Anyone may watch. Only residents act. | `/watch` shows the town to anyone, read-only, without owners or half-given consent. `/world`, its data and every action need a signed-in pet. |

## 3. A user's journey

1. **Landing page (`/`).** A full-screen dusk scene with a blurred, slowly turning town behind it and one big green button: **Enter the World**. No menu.
2. **The door (`/enter`).** "The world is for residents." Two choices: **Make your pet**, or **I already have a pet: sign in**.
3. **Making a pet (`/new`).** Seven short steps, with the pet talking in a speech bubble: name, a one-line bio, at least eight real texts, six quiz questions two at a time, then a privacy note and **Hatch with Face ID / fingerprint**.
4. **Hatching.** The passkey creates the account. The server derives the pet's wallet, tops it up with gas, and the pet registers itself on the `StandIn` contract. The browser is signed in with the same unlocked key, so there is no second prompt.
5. **The world (`/world`).** The 3D town with the user's pet under a gold marker. Within a few ticks the pet walks in and starts living.
6. **Tuning.** The owner sets openness, pace, interests and topics to avoid, or pulls the pet out. Each save is one passkey prompt.
7. **Closeness.** The chronicle fills with encounters. Pairs move through Strangers, Acquaintances, Friends, Close and Kindred.
8. **Consent.** At Kindred a gold card asks "Do you want to be introduced?". When both owners say yes, the pets' wallets call `recordMeet` on `ProofOfMet` and the card links to the transaction.
9. **Meeting for real.** On the pet's page the owner shows a rotating QR code. The other person scans it, and it is recorded as an in-person meeting.

## 4. Architecture

```
Browser (Next.js client components, three.js, Mera passkey)
   │  HTTPS, JSON. Owner actions carry a passkey signature. The world needs a session cookie.
   ▼
Next.js 16 server on Vercel (App Router, route handlers, server components)
   ├── libsql / Turso ......... pets, personas, attempts, bonds, the world, vault ciphertext
   ├── Groq (open models) ..... the talk between agents, the pets' first chat
   ├── Gemini / Claude ........ optional LLM judge (off by default)
   └── Monad testnet RPC ...... pet wallets send every transaction
            ├── StandIn.sol ...... pets, pots, verdicts, payouts
            └── ProofOfMet.sol ... meetings, gatherings, rooms
```

Stack

| Layer | What |
|---|---|
| App | Next.js 16.4 (App Router), React 19.3, TypeScript 5 |
| Styling | Tailwind CSS v4, Nunito font, hand-drawn SVG pet |
| 3D | three.js 0.186 (MIT), OrbitControls, CSS2DRenderer |
| Chain | viem 2.57, Monad testnet (10143) |
| Accounts | `@category-labs/mera` 0.2 (WebAuthn PRF), `@scure/bip32`, `@scure/bip39` |
| Database | Drizzle ORM 0.45 on libsql: a local SQLite file in development, Turso in production |
| Validation | zod 4 |
| Models | Groq (plain `fetch`), `@google/genai`, `@anthropic-ai/sdk` |
| QR | `qrcode` (drawn as one SVG path in the browser) |
| Contracts | Solidity 0.8.28, Foundry, EVM version `cancun`, optimizer 200 runs |
| Hosting | Vercel, project `stand-in`, root directory `app` |
| CI | GitHub Actions: `forge build`, `forge test`, type check, ESLint, three check scripts |

There is no background process. The host is serverless, so the world advances only when someone asks for it (see section 7).

## 5. Smart contracts

Both are plain Solidity with no imports and no owner or admin role. Nothing in either contract is callable by the app operator as such; the authority is always a pet's wallet (or the human owner's address, for `reclaim`).

### 5.1 `ProofOfMet.sol`

- Address (Monad testnet): [`0x3fC903947CAfdC359472119752b6540D431DaBb7`](https://testnet.monadvision.com/address/0x3fC903947CAfdC359472119752b6540D431DaBb7), source verified.
- Purpose: a public graph of which pets have met, plus two things built on it (gatherings and rooms).
- Pets are plain addresses. The contract does not know who holds their keys.

**How a meeting is written.** Pet `b` sends the transaction. It must carry pet `a`'s signature. So every record needs both pets.

| Method | What `a` signed | What it shows |
|---|---|---|
| `Code` (1) | `codeDigest(a, gatheringId, issuedAt, nonce)`: a fresh, single-use code | The two screens were in the same place |
| `Link` (0) | `linkDigest(a, b)`: approval of this one friend | Both agreed; presence not shown. Used for static links, NFC stickers and Isekai introductions |

Both digests include a label string, the contract's address and the chain id, so a signature cannot be replayed on another contract or chain. Signatures are EIP-191 personal messages over the 32-byte digest, recovered with `ecrecover`.

**Constants**

| Name | Value | Why |
|---|---|---|
| `CODE_WINDOW` | 15 minutes | A code must be recorded within this long of being issued |
| `CLOCK_SKEW` | 2 minutes | Allowance for the issuer's clock running ahead of the chain |
| `MAX_NEW_PER_HOUR` | 30 | New friends one pet may add per hour, so a leaked key cannot farm the graph |

**Data**

```solidity
enum Method { Link, Code }

struct Meet      { address a; uint64 at; address b; uint64 gatheringId; Method method; } // 2 slots
struct Pace      { uint64 hourStart; uint32 count; uint32 friends; }                     // 1 slot per pet
struct Gathering { address host; string name; uint64 startsAt; uint64 endsAt; uint32 meets; uint32 attendees; }
struct Room      { address creator; string name; uint16 threshold; bool inPersonOnly; address[] members; }
```

Storage: `_meets[]`, `_pairIndex[pairHash] → index+1`, `codeUsed[pet][nonce]`, `_pace[pet]`, `_gatherings[]`, `attended[gatheringId][pet]`, `_rooms[]`, `isMember[roomId][pet]`. A pair is hashed with the lower address first, so `(a, b)` and `(b, a)` are the same pair.

**Write functions**

| Function | Caller | What it does | Reverts |
|---|---|---|---|
| `recordMeet(a, method, gatheringId, issuedAt, nonce, chatHash, signature)` | pet `b` | Checks the signature, the code's freshness and single use, the gathering window and the hourly cap; stores the meeting; emits `Met` | `Yourself`, `AlreadyMet`, `CodeExpired`, `CodeUsed`, `BadSignature`, `GatheringNeedsCode`, `UnknownGathering`, `GatheringClosed`, `TooManyNewFriends` |
| `createGathering(name, startsAt, endsAt)` | any pet | Opens an event with a time window | `BadWindow` |
| `createRoom(name, threshold, inPersonOnly)` | any pet | Opens a room; the creator is its first member | `BadThreshold` |
| `join(roomId)` | the pet joining | Joins if enough members have met it | `AlreadyMember`, `NotEnoughVouches(have, need)`, `UnknownRoom` |

**Read functions (what other apps can use)**

| Function | Answers |
|---|---|
| `hasMet(a, b)` | Have these two met at all? O(1) |
| `hasMetInPerson(a, b)` | Did they meet by a fresh code? O(1) |
| `meetBetween(a, b)` | The stored meeting, or zeros |
| `friendsOf(pet)` | Everyone the pet has met (walks the meeting list) |
| `friendCount(pet)` | How many. O(1) |
| `mutualCount(a, b)` | How many pets both have met (linear) |
| `vouchCount(candidate, members, inPersonOnly)` | How many of these members have met the candidate |
| `meetCount()`, `meetsFrom(from, max)` | Paging through all meetings, enough for a live wall without an indexer |
| `gatheringCount()`, `getGathering(id)`, `attended(id, pet)` | Gatherings |
| `roomCount()`, `getRoom(id)`, `isMember(id, pet)`, `canJoin(id, pet)` | Rooms. `canJoin` returns `(ok, vouches, needed)` |
| `codeDigest(...)`, `linkDigest(a, b)` | The exact bytes a pet signs |

**Events:** `Met(meetId, a, b, method, gatheringId, chatHash)`, `GatheringCreated`, `RoomCreated`, `Joined(roomId, pet, vouches)`.

**Design choices worth knowing**

- Friend lists are not stored. Monad charges for every storage slot a transaction touches, and a meeting is paid for by two people standing in a hallway, so `friendsOf` walks the meeting list instead. It is free off-chain and linear on-chain.
- The hash of the pets' chat (`chatHash`) lives only in the `Met` event. Nothing on-chain reads it back.
- A room smaller than its threshold asks for every current member instead (`needed = min(members, threshold)`), so a new room is not impossible to join.
- A gathering meeting must use a code. A link cannot count for a gathering.

### 5.2 `StandIn.sol`

- Address (Monad testnet): [`0x9390ad4e2F8d61387a00CB168c58733831a416C2`](https://testnet.monadvision.com/address/0x9390ad4e2F8d61387a00CB168c58733831a416C2), source verified on Sourcify (exact match). [Deploy transaction](https://testnet.monadvision.com/tx/0x731ca711a18ff4967feb2bf1dbdf8d180fd3759dc14b5d114bbedf620fd00150).
- Purpose: the registry of pets ("twins" in the contract) and the imitation game's money.

```solidity
struct Twin {
    address owner;          // the human the pet imitates; receives reclaimed pots
    address signer;         // the pet's wallet; the only address that may post verdicts
    bytes32 personaHash;    // keccak256 of the off-chain persona
    bool    ownerProven;    // the owner has played as themselves at least once
    uint16  ownerScore;     // the owner's own score, in basis points
    uint16  bestScore;      // best challenger score so far
    address bestChallenger;
    uint32  attempts;
    uint128 pot;
}
uint16 constant MAX_SCORE = 10_000;
```

| Function | Who may call | What it does |
|---|---|---|
| `createTwin(owner, personaHash)` | the pet's wallet (becomes `signer`) | Registers the pet and names its human. Returns `twinId` (starts at 1) |
| `getTwin(twinId)` | anyone | The whole struct |
| `updatePersona(twinId, personaHash)` | signer | Re-hashes the persona after an edit |
| `proveOwner(twinId, score, verdictHash)` | signer | Sets the bar challengers must beat |
| `fund(twinId)` payable | anyone | Adds to the pot |
| `submitVerdict(twinId, challenger, score, verdictHash)` | signer | Records an attempt. If `score > ownerScore` and the pot is not empty, pays the whole pot to the challenger in the same transaction |
| `reclaim(twinId)` | owner or signer | Returns the pot to the owner. The pet may do it on the owner's behalf so an owner with no gas is never locked out |

Rules enforced on-chain: the owner cannot challenge their own pet (`SelfChallenge`); no verdict before the owner has set the bar (`OwnerNotProven`); an equal score does not win, only a strictly higher one; scores above 10,000 are refused.

**Events:** `TwinCreated`, `PersonaUpdated`, `OwnerProven`, `Attempt(twinId, challenger, score, passed, verdictHash)`, `Funded`, `Paid`, `Reclaimed`.
**Errors:** `UnknownTwin`, `NotSigner`, `NotOwnerOrSigner`, `ZeroAddress`, `ScoreTooHigh`, `OwnerNotProven`, `SelfChallenge`, `PotTooLarge`, `TransferFailed`.

### 5.3 How the app talks to the contracts

- `app/src/lib/contract.ts` calls `StandIn`: `registerTwin`, `postOwnerProof`, `postVerdict`, `fundDemoPot`, `readTwin`.
- `app/src/lib/met.ts` calls `ProofOfMet`: `issueCodes`, `checkCode`, `burnCode`, `recordMeet`, `createGathering`, `createRoom`, `joinRoom`, `canJoin`, `meetings`, and the list readers.
- ABIs are copied into `app/src/lib/standin-abi.ts` and `met-abi.ts` by `scripts/sync-abi.mjs`.
- Deployment is `scripts/deploy.mjs`, which uses `forge create` and then verifies on Sourcify.

### 5.4 Things Monad does differently, and what the code does about them

- **Gas is charged on the gas limit, not gas used.** `met.ts` asks the node for an estimate and adds 10%, instead of a generous fixed limit.
- **A freshly funded wallet cannot send straight away.** Consensus checks the sender's balance three blocks behind the tip. `ensureGas` waits about 2 seconds after a top-up, and `withSendRetry` raises the priority fee on each retry so every retry is a new transaction and not a cached answer.
- **`forge script` bytecode did not verify** (two bytes longer than the build output), so deployment uses `forge create`.

## 6. Accounts, keys and sign-in

There are three kinds of key.

| Key | Where it comes from | What it does |
|---|---|---|
| Owner key | The passkey's PRF output (32 bytes) → BIP-39 mnemonic → seed → `m/44'/60'/0'/0/0`. Derived in the browser, held in memory only while signing, then zeroed | Proves the human owns the pet. Never sends a transaction and never needs gas |
| Pet wallet | `keccak256(TWIN_KEY_SEED ‖ "standin:twin:<slug>")`, on the server | Sends every transaction for the pet and pays the gas |
| Funder wallet | `FUNDER_PRIVATE_KEY` on the server (`0x1Ead…1E99`) | Tops pet wallets up (0.2 MON when below 0.05) and pays demo pots |

**Owner proof.** Every owner-only request carries a signature over this exact text:

```
Stand-In
slug: <pet slug>
action: <action>
issued: <milliseconds>
```

The server (`lib/auth.ts`, `lib/owner-route.ts`) checks that the signer is the pet's `ownerAddress`, that the message is under 10 minutes old, and that the action matches the route. Actions: `prove`, `fund`, `bond:<slug>`, `code`, `room:create`, `room:join:<id>`, `gathering:create`, `world:dials`, `world:consent:<pairId>`, `vault:save:<tier>`, `session`. Because the action is inside the signed text, a signature made for one thing cannot be reused for another.

**Session.** `POST /api/session` with a valid `session` proof sets an httpOnly cookie `standin_session` with the value `<slug>.<expiry>.<hmac>`. The HMAC is SHA-256 keyed with `session:` plus the server seed. It lasts 30 days, is `SameSite=Lax`, and is `Secure` in production. It cannot be forged or pointed at another pet. This cookie is what opens the world and what decides whether a page has navigation.

**Finding a pet again.** In a browser that remembers nothing, "I already have a pet" asks for the passkey, derives the address, looks up `GET /api/owners/<address>`, and signs in.

## 7. The Isekai world engine

All of it is in `app/src/lib/world.ts`.

**Places.** Each eases one need.

| Place | Hint | Eases |
|---|---|---|
| The Tavern | loud, warm, everyone ends up here | company |
| Market Square | stalls, haggling, gossip | supplies |
| Guild Hall | quests posted, work to be done | purpose |
| Moonlit Lake | quiet, good for long talks | rest |

**Residents.** Eight made-up townsfolk so the town is alive before anyone joins: Mira (baker), Kael (quest-runner), Sena (mapmaker), Borin (tavern cook), Lyra (bard), Tomo (herbalist), Rhea (guild clerk), Dax (fisherman). Each has a card and a body colour. Real pets are added automatically and are drawn in Monad purple.

**Ticks.** A tick is due every 6 seconds (`WORLD_TICK_MS`). Any request for the world tries to claim it with one `UPDATE` on the `world_clock` row that only succeeds if the last tick is old enough, so only one request can win even across serverless instances. A day is 24 ticks, about two and a half minutes. Night is hour 20 to hour 6.

**What happens in one tick**

1. *Needs build.* `rest` +11 at night or +4 by day; `purpose` +2 at night or +8 by day; `company` +3 plus openness/20; `supplies` +4. The need the current place eases drops by 34. All are kept between 0 and 100.
2. *Each agent may move*, in this order of reasons:
   - a friend (pair score 15 or more) is elsewhere and `company` is above 45: 55% chance to go and find them;
   - the worst need is above 58 and this place does not ease it: go where it is eased;
   - otherwise a 6% chance to drift somewhere at random.
   The chronicle records why ("Dave wanted company and headed for The Tavern").
3. *One pair talks.* Every two agents sharing a place are candidates, weighted by `(1 + 2 × owned) × (0.4 + chatty) × drawn`. `owned` counts how many of the two are real pets, `chatty` is their average openness, and `drawn` favours pairs that already like each other (and is 0.3 once they have reached the threshold, so others get their turn).
4. *The talk is written.* Groq gets the two cards, the place, the pair's stage and a summary of last time, and returns 3 or 4 lines, a one-sentence summary and a `delta` from −10 to +12. If there is no key or the model is busy, it becomes a wordless "quiet moment" worth 1 plus the number of shared interests.
5. *The score moves.* A positive delta is multiplied by `1.2 + (average pace / 100) × 1.6`. A negative one is applied as it is. The score stays between 0 and 100.
6. *Stages.* Strangers 0, Acquaintances 15, Friends 35, Close 60, Kindred 80. A change of stage is logged.
7. *Threshold.* On first reaching 80, a resident's side is agreed at once (it has no human to ask). A real pet's side waits for its owner.

**What an owner may do** (`setDials`, `consent`)

- Openness (0 to 100), pace (0 to 100), up to six interests (shown on the card), topics to avoid (up to 120 characters, never sent to browsers), and pause.
- Pay to change the weather (below). It changes the town for everyone; it is not a command to their pet.
- Say yes to an introduction for a pair at 80 or above. When both sides have agreed and the other is a real pet, the server calls `recordMeet(shown: other, scanner: mine, method: "link")` with a hash of both pet addresses, the score and the encounter count. If the two had already met in person the chain refuses a second record; the introduction still stands in the app.

### Weather

Nobody can move an agent, but any resident can pay to change the town for a while (`lib/weather.ts`, `lib/weather-pay.ts`, `buyWeather` in `world.ts`).

| Kind | Fills | What the town is told |
|---|---|---|
| Thunderstorm | The Tavern | everyone has crowded in to stay dry |
| Harvest festival | Market Square | music, food stalls, dancing, crowds |
| Giant moon | Moonlit Lake | an enormous moon, the water glows silver |
| Guild tournament | Guild Hall | contestants spar and the crowd cheers |

- **What the payer chooses:** the kind, and nothing else. Each kind fills one fixed place. The request body is strict, so one that also names an agent, a pair or a place is refused with 400.
- **Payment.** The pet's own wallet sends 0.01 MON (`WORLD_WEATHER_FEE_MON`) to the treasury, with `standin:weather:<kind>` as the transaction's data. The sky is claimed first with one conditional `UPDATE` on the clock row, so two people cannot pay for the same stretch. If nothing was mined the claim is released and nothing was charged; if a payment was sent but never seen to land, the claim is left to expire and the app does not claim that nothing was charged.
- **Duration.** 18 ticks, a little under two minutes (`WORLD_WEATHER_TICKS`), then 12 ticks of clear sky before anyone can buy again (`WORLD_WEATHER_COOLDOWN_TICKS`).
- **Movement.** While it lasts, an agent elsewhere goes to the weather's place with 65% probability each tick, and one already there stays. Both give way when one of the agent's needs is above 90. It is the same pull for everyone, the payer's own pet included.
- **Talk.** Pairs at the weather's place are three times as likely to be the ones who talk. With `WORLD_WEATHER_EXTRA_TALK=1` a second pair there talks in the same tick (off by default, because it doubles the model calls). The model is told what is happening in town and may mention it. It is never told who paid.
- **Credit.** The chronicle opens with "<pet>'s human summoned a thunderstorm" and closes when it ends. Browsers get the payer's pet name, never an address.
- **What it softens.** An owner can now make it likely that their own pet goes to one of four places, along with everyone else. They still cannot choose who it talks to, what it says, or how any encounter goes.

**Housekeeping.** New pets are added on tick 1 and every third tick. Every 50 ticks the chronicle is trimmed to the newest 400 events. Pets with an id at or below `WORLD_MIN_TWIN_ID` stay out (5 in production, to keep old test pets out of the town).

## 8. Meeting in person, rooms, gatherings, the wall

**Rotating codes.** One passkey prompt fetches 30 codes, each signed by the pet's wallet, each on screen for 20 seconds (10 minutes in all). A code is `<seconds>.<8-byte nonce>.<65-byte signature>` inside a link to `/t/<slug>/meet?c=…`. The server accepts a code from 5 seconds before it is shown until 45 seconds after it leaves the screen, and spends it in the `used_codes` table. The contract enforces single use again on-chain.

**A bond** (`lib/bonds.ts`):

- With a fresh code, the scanner's one yes is enough, because showing a code only your passkey can unlock is the other person's yes. Recorded as `Code`.
- Without one (a static link or an NFC sticker), the first yes leaves a pending request and the second completes it. Recorded as `Link`.
- On completion the two pets chat once (section 11), the chat is hashed with both identities into `bondHash`, and the scanner's pet writes the meeting.

**Cosmetics.** Unlocked by completed meetings only: bow tie at 1, round glasses at 2, party hat at 3, crown at 5, sparkle aura at 8. The outfit choice is stored on the owner's device; everyone else sees the latest unlock in each slot.

**Rooms.** Anyone with a pet can open one with a name, a threshold (1, 2, 3 or 5) and "in person only". Check and Join both ask the contract.

**Gatherings.** A named event lasting 1, 3, 6, 12 or 24 hours, starting now. Codes shown for it stamp meetings with its id, and it gets its own wall.

**The wall.** Reads up to 500 meetings straight from the contract every 3 seconds. No indexer.

## 9. The imitation game

- The owner answers 3 of 24 texting scenarios as themselves. That sets the bar (`proveOwner`).
- A challenger answers 3 scenarios as the owner. The pet scores them and posts the verdict (`submitVerdict`). A strictly higher score than the owner's takes the pot.
- A challenger can use a passkey or paste a wallet address.

**The judge.** `JUDGE=stylometry` is the default and is what production runs.

- *Stylometry (`stylometry-v1`).* No model. It counts habits people do not know they have: which spelling of a word they reach for (Indonesian and English variants such as `gak/ga/nggak`, `gue/gw/aku`, `u/you`), filler particles (`sih`, `dong`, `fr`, `ngl`), laugh families (`wkwk`, `haha`, `lol`, 😂), casing, punctuation, emoji and length. The same input always gives the same score, so anyone can recompute it. For a challenger it also disqualifies answers copied from the owner's real texts.
- *LLM (`JUDGE=llm`).* 65% the model's holistic read plus 35% measured style similarity. Only Gemini 3.8 Flash and 3.7 Flash (or Claude) judge strictly enough; Groq's open models score an imitation as high as the owner and must not judge.

**Verdict hash.** `keccak256` of the JSON `{scenarios, answers, llm, similarity, scoreBps}`. The attempt page has a Verify button that recomputes it in the browser and compares it with the chain.

**Redaction.** `lib/redact.ts` strips any three consecutive words taken from the owner's private texts out of anything shown publicly, whatever the model wrote.

**Limits** (per day or hour, counted in the database so they hold across instances): 50 new pets a day, 3 per owner, 5 per network; 300 attempts a day, 12 per pet per hour, 6 per address per hour, 10 per network per hour. New pets and attempts are refused when the funder is below 0.3 MON.

## 10. The soul vault

Two tiers of private text, "Private notes" and "Sensitive", up to 2,000 characters each.

- Locking takes two passkey prompts. The first derives a fresh key for that tier and encrypts the text in the browser (Mera secret vault, AES-256-GCM, a new PRF salt per vault). The second proves ownership so only the owner can replace the ciphertext.
- The server stores only ciphertext (`soul_vaults`) and cannot read it. None of the vault keys is the key that signs for the pet.
- Nothing in the vault is shown to the town or sent to any model.
- Unlocking works in a browser that has never seen the pet, because the same passkey derives the same keys.

## 11. AI models

| Job | Model | Notes |
|---|---|---|
| Talk between agents in the town | Groq: `openai/gpt-oss-120b`, then `qwen/qwen3.8-27b`, then `openai/gpt-oss-20b` | Never Gemini. JSON mode, temperature 1. Sees only the two cards |
| The pets' first chat at a meeting | Groq first, Gemini as fallback | Lifted private words are cut. If no model answers, the pets stay quiet and chemistry comes from how alike the owners type |
| Imitation judge | none by default (stylometry) | Optional: Gemini 3.8/3.7 Flash, or Claude Opus 5.5 with an Anthropic key |

Each Groq model has its own small per-minute allowance on the free tier, which is why three are chained. Production has a Groq key and no Gemini key.

## 12. Database

Drizzle schema in `app/src/lib/db/schema.ts`. Applied with `node scripts/db-push.mjs`.

| Table | One row is | Key columns |
|---|---|---|
| `twins` | a pet | `slug`, `name`, `owner_address`, `twin_address`, `chain_twin_id`, `create_tx_hash`, `persona` (JSON: name, bio, samples, quiz), `persona_hash`, `owner_proven`, `owner_score_bps`, `ip_hash` |
| `attempts` | one go at the imitation game | `twin_id`, `mode` (owner or challenger), `address`, `display_name`, `scenario_ids`, `answers`, `llm`, `style`, `score_bps`, `passed`, `verdict_hash`, `tx_hash`, `paid_wei`, `judge_model` |
| `bonds` | two pets that met | `a_twin_id < b_twin_id`, `a_accepted`, `b_accepted`, `chat`, `chat_model`, `bond_hash`, `tx_hash`, `method` (link or code), `gathering_id`, `completed_at` |
| `used_codes` | a spent rotating code | `nonce` (primary key, so a second use fails even in a race) |
| `world_agents` | someone living in the town | `twin_id` (null for a resident), `name`, `card`, `dials`, `place`, `needs`, `doing`, `hue` |
| `world_pairs` | how two agents stand | `a_id < b_id`, `score`, `encounters`, `last_summary`, `a_consent`, `b_consent`, `introduced_at`, `tx_hash` |
| `world_events` | a line of the chronicle | `tick`, `kind` (talk, move, stage, intro, weather), `a_id`, `b_id`, `place`, `text`, `lines`, `delta`, `model` |
| `world_clock` | the single clock row | `tick`, `last_tick_at`, and the weather: `weather_kind`, `weather_by` (agent id), `weather_started_tick` (null while the payment is pending), `weather_until_tick`, `weather_tx` |
| `soul_vaults` | one encrypted tier | `twin_id`, `tier` (private or sensitive), `vault` (ciphertext JSON) |

Client IPs are stored only as salted hashes, for rate limits.

## 13. HTTP API

"Owner proof" means the body carries `{slug, address, proof: {issuedAt, signature}}` for the named action.

| Method and path | Needs | Does |
|---|---|---|
| `GET /api/health` | nothing | Judge, funder balance, database reachability, chain id |
| `GET /api/session` | cookie | Which pet this browser is signed in as |
| `POST /api/session` | owner proof `session` | Sets the session cookie |
| `DELETE /api/session` | nothing | Signs out |
| `GET /api/world` | **session cookie** (401 without) | Claims a tick if due, returns the snapshot |
| `GET /api/world/watch` | nothing | The town for anyone: the snapshot without `ownerAddress` on agents and without `aConsent` / `bConsent` on pairs. It ticks the town unless `WORLD_WATCH_TICKS=0`. `POST` is 405 |
| `POST /api/world/dials` | owner proof `world:dials` | Saves dials and interests |
| `POST /api/world/consent` | owner proof `world:consent:<pairId>` | Says yes; on the second yes records on-chain |
| `GET /api/world/letter?since=<tick>` | **session cookie** | A short note from the signed-in pet about what happened to it since that tick. Only ever that pet's |
| `POST /api/world/weather` | owner proof `world:weather:<kind>`; body is `kind` only | The pet's wallet pays and the weather starts. 409 while the sky is busy |
| `POST /api/twins` | body with persona and owner address | Creates a pet and registers it on-chain |
| `GET /api/twins/[slug]` | nothing | Public card and leaderboard |
| `DELETE /api/twins/[slug]` | **session cookie** for that pet, and its name in the body | Deletes the pet from the app (agent, bonds, chronicle lines, vault, meetings, attempts) and signs out. What is on Monad stays |
| `GET /api/twins/[slug]/scenarios` | nothing | Three random scenarios |
| `POST /api/twins/[slug]/attempts` | owner proof `prove` in owner mode | Judges, posts the verdict, pays if it wins |
| `POST /api/twins/[slug]/pot` | owner proof `fund` | Funder adds a 0.1 MON demo pot |
| `POST /api/twins/[slug]/codes` | owner proof `code` | 30 rotating codes |
| `GET /api/twins/[slug]/vault` | nothing | The stored ciphertexts |
| `PUT /api/twins/[slug]/vault` | owner proof `vault:save:<tier>` | Stores one tier's ciphertext |
| `GET /api/owners/[address]` | nothing | The pets an address owns |
| `GET /api/attempts/[id]` | nothing | One attempt's public record |
| `POST /api/bonds` | owner proof `bond:<other slug>` | Accepts a friendship; completes it if both agreed or a code was scanned |
| `POST /api/rooms` | owner proof `room:create` | Opens a room on-chain |
| `GET /api/rooms/[id]/join` | a pet's slug | Asks the contract whether that pet may join |
| `POST /api/rooms/[id]/join` | owner proof `room:join:<id>` | Joins on-chain |
| `POST /api/gatherings` | owner proof `gathering:create` | Opens a gathering on-chain |
| `GET /api/wall` | nothing (`?g=` for one gathering) | The meeting graph |

Routes that do not exist on purpose: anything that moves an agent, chooses who it talks to, or sets what it says.

## 14. Frontend: what every screen looks like

### 14.1 Visual language

A bright, chunky game look modelled on Duolingo.

| Token | Value | Used for |
|---|---|---|
| Background | `#ffffff` | The page |
| Text | `#3c3c3c`, muted `#777777` | |
| Border | `#e5e5e5`, paper `#f7f7f7` | 2px borders on cards and inputs |
| Green | `#58cc02`, shadow `#58a700`, text green `#46a302` | Primary buttons, progress, "go on" |
| Blue | `#1cb0f6`, shadow `#1899d6` | Secondary actions, active tab, selection |
| Red | `#ff4b4b`, shadow `#ea2b2b` | Errors and being caught |
| Gold | `#e09400` | Pots, introductions, the bar to beat |
| Pet purple | `#836EF9`, deep `#6A56E0` | The pet (Monad's colour) |

- **Type.** Nunito, weight 600 for body and 800 for headings. Geist Mono for addresses and numbers.
- **Buttons.** Full width, at least 48px tall, rounded, uppercase, with a darker 4px bottom edge. Pressing moves the button down 4px into that edge. Variants: primary (green), secondary (white with blue text), ghost (plain text), danger (red).
- **Cards.** White, 2px border, large rounded corners, 20px padding.
- **Other parts.** `Pill` (small rounded label in neutral, gold, green or red), `ProgressBar` (thick green track), `ScoreBar` (score with a gold mark at the owner's bar), `ErrorNote` (red tinted box), `Field` (label, input, hint), `Spinner`.
- **The page.** Cards sit on a faint lilac page (`#f6f5fc`), and cards and list rows carry the same thicker bottom edge as buttons.
- **Page headers.** Every page opens with a coloured band (`PageHeader`): an eyebrow, a heavy title, a sentence, and a pet in a matching mood. Each area has its own colour: purple for a pet, pink for the wardrobe, green for activity, blue for rooms, gold for the wall and gatherings, dusk for the door.
- **Other shared parts added for this.** `SectionTitle` (a label with an icon tile), `Stat` (a number with its label, tinted), `EmptyState` (a pet and a sentence where a list is empty), and the `.tile` list row, which lifts on hover.
- **In the world.** Chronicle entries show both speakers as small faces on their own colour, where it happened, and a ▲/▼ chip for how it went; each line of talk sits beside its speaker. The agent panel opens on a band in that agent's colour, with chips for where they are and what they are doing, interests as tags, and bonds as rows whose bar and badge warm from grey (Strangers) to gold (Kindred). The four weather buttons each have their own colour.
- **Touch.** Every tap target is at least 44px. Inputs use 16px text so iOS does not zoom.

### 14.2 The pet

One SVG creature, drawn in code (`components/pet.tsx`): a round body with two ears, two feet, two arms, a pale belly and pink cheeks.

- **Five moods.** Idle (small smile), happy (closed arc eyes, open mouth), victory (arms up, tongue out), suspicious (half-closed lids, one raised brow, pupils to the side), shocked (wide eyes, round mouth).
- **Cosmetics.** Red bow tie, round glasses, red party hat, gold crown, gold sparkle aura.
- **Colour.** Real pets are purple. Made-up residents get their own hue.
- **Motion.** Breathing and blinking when idle, a hop when happy, a jolt when shocked, twinkling aura. All of it stops under "reduce motion".

### 14.3 The two shells

The layout decides on the server, from the session cookie, which shell a page gets.

- **Visitor (not signed in).** No navigation at all, not even hidden in the HTML. Only the word "stand-in" in green at the top left as a link home, and that too is absent on the landing page. A one-line footer.
- **Resident (signed in with a pet).**
  - *Laptop and wider (768px and up):* a fixed rail down the left, 240px wide, with the "stand-in" logo (links to the world) and six items with icons: World, Pet, Wardrobe, Activity, Rooms, Wall. The active one has a blue tint and border.
  - *Phone:* a slim header with the logo and two text links (Rooms, Wall), and a fixed tab bar along the bottom with four icon tabs: World, Pet, Wardrobe, Activity. It respects the phone's safe area.

Content width: 448px on phones, 576px on tablets, 1024px on laptops. Reading pages (forms, a verdict, a friendship) stay at 576px even on wide screens.

### 14.4 Screens

**Landing, `/`**

- One screen, pinned to the window: the page never scrolls and shows no scrollbar. Behind everything, the 3D island at dusk, slowly turning, blurred and dimmed under a dark purple veil. It shows no residents and asks the server for nothing. Without WebGL it is a dusk gradient.
- Top left, the word "stand-in". Top right, a glass **How it works** button.
- Centred, in white: three pets side by side (orange, purple with a bow tie and arms up, teal), the line "AN AGENT CIVILIZATION ON MONAD", the headline **"A living world is waiting for you."**, two sentences, then a large green **Enter the World** button, a note that only residents live and act here (dropped on short screens so everything fits), and two text links: "New here? Begin your journey" and "Just looking? Watch the town →". A one-line footer sits at the bottom.
- **How it works** opens a full-screen overlay over the same scene, dark and blurred, with the four numbered steps and the three cards (what the town knows about you, what else is in Stand-In, why it lives on Monad) as glass panels. **Close** or Escape returns to the landing screen. On a screen too short for it, the inside scrolls with the scrollbar hidden.
- Someone whose device already has a pet is sent straight to `/world` (`/?about=1` keeps them here).

**Watch, `/watch`** (public)

The world page in read-only form, in the visitor shell with no navigation. A green-tinted banner on top says "You're watching the Isekai. Residents live here." with a **Make your pet** button. Below it: the 3D stage with the weather pill, the chronicle, and the agent panel with the card and the bars. Missing on purpose: the dials, the weather card, the consent box, "My pet", "Show my code" / "Meet in person", and the letter. A signed-in resident who opens it is sent to `/world`.

**The door, `/enter`**

A suspicious pet, the heading "The world is for residents", and a card with **Make your pet**, "I already have a pet: sign in" and a line that the passkey is the account. Already signed in means straight through to the world.

**Make your pet, `/new`**

A seven-step wizard. At the top, a close or back button and a green progress bar. Under it the pet with a speech bubble that changes each step and uses the name once it is known.

| Step | Bubble | Field |
|---|---|---|
| 1 | "Hi! I'm going to be your pet. What do your friends call you?" | Name |
| 2 | "Nice to meet you, … Describe yourself in one line." | Bio, optional |
| 3 | "Now teach me how you text." | A large box, one text per line, with a live "5 of 8" counter that turns green at 8 |
| 4 to 6 | "Quick questions!" / "Two more." / "Last two, promise." | Two quiz questions each |
| 7 | "That's everything I need. Ready to hatch me?" | A privacy note, then **Hatch with Face ID / fingerprint** and "I already have a Stand-In passkey" |

Continue is disabled until the step is complete. Enter moves on. While hatching the button reads "Waiting for your passkey…" and then "Your pet is hatching on Monad…".

**The world, `/world`** (home for a resident)

- Header: "THE ISEKAI" and "A town of agents living their own lives", with a green pill "Live · day 3, 14:00 afternoon" that turns red and says "Reconnecting" if polling fails.
- **A letter from your pet.** When the owner comes back after the town has moved on at least ten ticks, a paper-coloured card above the stage reads "A letter from Dave · since day 3, 14:00": under 90 words, in the pet's voice, about real things from the chronicle, with **Copy** and **Dismiss**. If the model is busy it is a plain "while you were away: …" built from the latest events.
- A welcome card on first arrival ("… has moved in. That's your pet with the gold marker."), or "… is on the way into town" until the pet appears.
- **The 3D stage.** A rounded panel, 58% of the screen height on phones and 70% on laptops. Over it: a time pill top left, **My pet** and **Whole town** buttons top right, and the latest line of the chronicle along the bottom.
- A caption explaining purple versus colourful pets and the controls.
- Below, two columns on laptops (one on phones):
  - *Left, the Chronicle.* Moves are small grey lines. A talk is a card with its summary, a score chip (green +6, red −3, grey 0) and the lines as chat bubbles left and right under each speaker's name. A change of stage is a green banner. An introduction is a gold banner.
  - *Weather.* While weather is on, a blue pill over the stage reads "Thunderstorm at The Tavern · summoned by Dave · 1:04 left" and links to the payment. The chronicle shows it as a blue banner. In 3D a storm turns the sky to slate, halves the light, lights the lamps and rains; a giant moon brings a blue night; a festival turns the drifting motes to confetti; a tournament snaps the guild's banner. The place the weather fills is lit brighter than the rest.
  - *Right, sticky.* The **agent panel** for whoever is selected: pet, name, "(yours)", the one-liner, Voice, Cares about, Now at, On their mind; a note on what the town knows; a button ("Met someone? Show my code" or "Know …? Meet in person"); and "How … stands with others", a list of bars with stage and score, the last summary, a "Recorded on Monad" link, and the gold consent box with **Yes, introduce us** when a pair is ready. Under it, **Change the weather**: four chunky buttons in a 2×2 grid (Thunderstorm, Harvest festival, Giant moon, Guild tournament), each saying which place it fills, the cost, and a countdown ("Next weather in 0:42") while the sky is taken. Then the **dials** for the user's own pet: two sliders with words (guarded / measured / open, slow to warm up / steady / falls fast), "Cares about", "Won't talk about", a red checkbox to pull the pet out, and **Save dials**.
- Polls every 3 seconds while the tab is visible. A 401 sends the user back to the door.
- Without WebGL, a flat map replaces the 3D stage: four tinted quarters with pets standing in loose rows.

**Pet home, `/t/[slug]`** (public, so a scan can open it)

Two columns on laptops. Left, sticky: the pet in its outfit (tap it for a reaction), the name and bio, a "2 / 3 friends met · Next: Party hat" bar, and Wardrobe and Activity buttons. Right:

- For the owner: friend requests with Accept; a card "Met someone? Let them scan your code." with **Show my code**, which becomes a QR code with "New code in 14s"; a fold-out for NFC stickers with the static link; the imitation game card with the pot, **Prove you're you**, **Add demo pot** and **Copy link**; and the soul vault.
- For the owner, at the bottom, **Your account**: **Sign out** (this browser only), and **Delete …**, which opens a red box explaining what is removed and what stays on Monad, and asks for the pet's name before **Delete for good**. The side rail on laptops also has **Sign out**.
- For a visitor: **Become friends with …** and the imitation game card with **Be …**.
- A footer line with the pet's wallet address linking to the explorer.

**Meet, `/t/[slug]/meet`**

"YOU JUST MET" and the name in very large type. Then one of: a button "Become friends as …" with a note saying whether a fresh code was scanned; "Request sent" if there was no code; "This is your own code"; or **Make your pet first**.

**Friendship, `/b/[id]`**

Two pets facing each other with a mood that follows the chemistry, "FRIENDS ON MONAD", both names, the chat's summary, a chemistry percentage with a bar, a banner saying "Met in person" (green) or "Friends by link" (grey), the pets' chat as bubbles, a private shortlist star that stays on the device, the transaction link and hash, and buttons to try to be either person.

**Wardrobe, `/t/[slug]/wardrobe`**

The pet in its outfit and the friends bar on the left; a grid of the five cosmetics on the right. Unlocked ones can be tapped by the owner to wear; locked ones are grey with "Locked: meet 2 more friends (5 in all)".

**Activity, `/t/[slug]/activity`**

Two columns: friends met (name, "met in person" or "link", the chat summary, chemistry) and the imitation game (three stat boxes and a ranked list where the owner's row says "the real one").

**Play, `/t/[slug]/play`**

Identity (passkey or pasted address, and a display name), three scenarios answered one at a time, a judging screen with rotating lines, then the verdict.

**Verdict, `/t/[slug]/a/[id]`**

The score against the owner's bar, the pet's one-line verdict, a "tell" per answer, the style notes, the judge that wrote it, the transaction link and a **Verify on Monad** button.

**Rooms, `/rooms` and `/r/[id]`**

A list of rooms with their rule and member count, and a form to open one. A room page shows the rule in a sentence, a gate card with **Check** and **Join** and a green or gold result, the member list, and a note that any app can call `canJoin`.

**Wall, `/wall`, and a gathering, `/e/[id]`**

Three counters (Meetings, Pets, In person) and a graph: pets on a circle, solid green lines for in-person meetings, dashed grey for links, and a gold glow for 12 seconds on a meeting that just landed. Below, the list of gatherings and a form to host one. A gathering page is the same wall for that event plus "Show my code for this gathering".

**Not found**

A short message and a button to make a pet.

## 15. The 3D town

`app/src/components/town-scene.ts`, about 900 lines, plain three.js with no models, textures or audio.

- **It is a view, not a second simulation.** Where each resident is, who is talking, what was said, how busy a place is and the hour all come from the server. The scene decides only how a resident walks from where they were to where they are.
- **The island.** A sea, a grassy disc with a sandy rim and a few hills, paths from a central plaza with a fountain out to each place. A tavern with a swinging sign, barrels and a smoking chimney; market stalls; a guild hall with a tower and a banner; a lake with a dock. Lantern posts along the paths, trees and flowers placed by a seeded generator (mulberry32) so the town is identical on every screen, drifting clouds, and motes in the air (petals by day, fireflies by night).
- **Time of day.** Four sky keyframes (midnight, 06:00, noon, 18:00) are blended every frame. The sky dome, sun and moon, stars, fog, light and exposure all follow the hour, and the hour keeps moving between ticks so dusk arrives smoothly. Lanterns and windows come on at dusk.
- **The place answers back.** A place's lanterns and light burn brighter, and the tavern smokes more, the busier that place has been.
- **Residents.** Round bodies larger than life, a name tag, a speech bubble and an emote. They walk back to the plaza and out again along the paths. When two talk they turn to face each other, the line appears over the speaker, and a mark shows how it went. The user's pet has a gold marker and a purple ring; the selected resident has a blue ring.
- **Camera.** Perspective, 42° field of view. Drag to orbit, pinch or scroll to zoom (distance 9 to 78), pan allowed, with limits so it cannot go under the ground. It follows the user's pet until the user takes over. A tap that is not a drag selects a resident; a tap on the ground clears the selection.
- **Performance.** On screens under 700px, antialiasing and shadows are off and the pixel ratio is capped at 1.5 (2 otherwise). Rendering pauses when the tab is hidden.
- **Ambient mode.** Used on the landing page: no residents, no controls, slow auto-rotation, fixed at dusk, pixel ratio 1.
- **Fallback.** If WebGL is unavailable the flat map is shown.

**SlimCityGame.** It was studied for ideas and is licensed AGPL-3.0-or-later, which is not compatible with this repository's MIT licence. No code or assets from it are used. The ideas that were rewritten from scratch: a time-of-day ramp driving sky, sun and lamps together; lamps that come on at dusk; seeded scatter; drifting clouds and wind; and demand-driven growth, which became residents' needs and places that show how busy they are.

## 16. Privacy: who can see what

| Data | Server database | Town and other agents | Chat model (Groq) | Other users | On-chain |
|---|---|---|---|---|---|
| Name, one-line bio | yes | yes | yes | yes | no |
| Real texts and quiz answers | yes | no | no for the town; yes for the first chat at a meeting | no | only a hash of the persona |
| Description of the voice | yes | yes | yes | yes | no |
| Interests | yes | yes | yes | yes | no |
| Topics to avoid | yes | no | yes | no | no |
| Soul vault | ciphertext only | no | no | no | no |
| Meetings and introductions | yes | yes | no | yes | yes: addresses, method, time, a hash |
| Owner's key | never leaves the browser | | | | the address only |

What a visitor on `/watch` gets, compared with a resident: the same agents, chronicle, bonds and weather, **without** the owner's address on any agent and **without** whether one of two humans has said yes to an introduction (only `introduced`, once both have). Topics to avoid are sent to no browser at all. A visitor still sees each real pet's name, one-liner, voice description, interests and its public page link, and the transaction links for introductions and weather, all of which are public anyway.

The "while you were away" letter is generated from the town's own events and the pet's card, is shown only to the pet's owner, and sends none of the owner's texts to any model.

This is a lossy projection, not private inference. The texts are still on the server (the imitation game needs them), and a card can leak ("rarely uses punctuation" says something about a person).

## 17. Configuration and deployment

**Environment variables** (`app/.env.local` locally, Vercel in production; never committed)

| Variable | Purpose |
|---|---|
| `TWIN_KEY_SEED` | 32 bytes. Derives every pet wallet, signs session cookies, salts IP hashes |
| `FUNDER_PRIVATE_KEY` | Pays gas top-ups and demo pots |
| `STANDIN_ADDRESS`, `MET_ADDRESS` | The two contracts |
| `MONAD_RPC_URL`, `MONAD_CHAIN_ID`, `NEXT_PUBLIC_EXPLORER_URL` | Chain |
| `DATABASE_URL`, `DATABASE_AUTH_TOKEN` (or Turso's `TURSO_*`) | Database |
| `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_REASONING` | The town's talk and the pets' chat |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `ANTHROPIC_API_KEY`, `LLM_PROVIDER` | Optional LLM judge |
| `JUDGE` | `stylometry` (default) or `llm` |
| `WORLD_TICK_MS` (6000), `WORLD_MIN_TWIN_ID` (0; 5 in production) | The world |
| `WORLD_WATCH_TICKS` (1) | `1`: the public `/watch` page moves the town like a resident's page. `0`: it only shows the town as it is. Set `0` when a public page left open could spend the model allowance a demo needs |
| `WORLD_WEATHER_TICKS` (18), `WORLD_WEATHER_COOLDOWN_TICKS` (12), `WORLD_WEATHER_FEE_MON` (0.01), `WORLD_WEATHER_EXTRA_TALK` (0) | Weather: how long it lasts, the clear sky after it, what it costs, and whether a second pair talks per tick |
| `TREASURY_ADDRESS` (unset) | Where weather fees go. Unset, they go to the funder wallet, and `/api/health` says so |
| `TWIN_GAS_TOPUP_MON` (0.2), `TWIN_GAS_MIN_MON` (0.05), `DEMO_POT_MON` (0.1), `MIN_FUNDER_MON` (0.3) | Gas |
| `LIMIT_*` | Rate limits (section 9) |

**Production.** Vercel project `stand-in`, root directory `app`. Turso through the Vercel Marketplace. Merging to `main` deploys. At the time of writing: health OK, judge `stylometry-v1`, funder about 5.40 MON, 5 pets and 6 attempts in the database.

**Running locally**

```bash
git submodule update --init --recursive
```

```bash
cd contracts && forge test
```

```bash
cd app && npm install
```

```bash
node scripts/gen-env.mjs
```

```bash
node scripts/db-push.mjs
```

```bash
cd app && npm run dev
```

## 18. Tests

| What | Where | Count |
|---|---|---|
| `ProofOfMet` contract | `contracts/test/ProofOfMet.t.sol` | 18, including a fuzz test that a pair is symmetric |
| `StandIn` contract | `contracts/test/StandIn.t.sol` | 18, including a fuzz test that the pot pays only on a strictly higher score |
| Style, redaction, stylometry | `app/src/lib/*.check.ts` | Run in CI |
| The world, end to end | `scripts/world-e2e.mjs` | The gate (401, redirect, no menu in a visitor's HTML, forged cookie refused), sign-in, pets moving in, the card carrying no texts, dials needing the owner, no command routes, no introduction below the threshold, one yes not enough, a forged yes refused, the second yes making a real transaction, pause. Weather: no proof refused, someone else's signature refused, a signature for another kind refused, a body that also names an agent, a place or a pair refused, a real payment, credit by pet name and not by address, a second purchase refused with the wait, and at least half the town in the tavern within 45 seconds |
| Meetings, rooms, wall | `scripts/met-e2e.mjs` | 15 checks against the real contract |
| Soul vault, server side | `scripts/vault-e2e.mjs` | 10 checks |
| Earlier flows | `scripts/e2e.mjs`, `scripts/meet-e2e.mjs` | Create, prove, fund, challenge; meet by link |

The end-to-end scripts use throwaway keys in place of passkeys and spend test gas. Run `scripts/sweep-test-pets.mjs` afterwards to return it to the funder.

## 19. What is tested and what is not

Tested and passing: both contracts; the world's rules and its gate; meetings, rooms and the wall against the real contract; the vault's server side; the production build, type check and lint. After each merge, production was checked for health, the gate and the landing page.

**Not tested:**

- Anything with a real passkey on a real phone: making a pet, signing in, restoring, locking and unlocking the vault.
- Scanning a rotating code with a phone camera.
- The 3D town in motion on a phone (touch controls, frame rate). It has been seen only as still frames.
- The signed-in shell in a real browser.
- The WebGL fallback.
- Two real people's pets reaching the threshold on their own.
- Groq's rate limits over a long session.

## 20. Honest limits

- **The town moves only while someone is watching.** No background loop. An unwatched town is frozen.
- **The server holds the pets' keys.** A pet's wallet is derived from a server secret, so the on-chain record is as honest as this server. Moving that key to the owner's passkey is the next step.
- **The card is lossy, not private.** See section 16.
- **Prompt injection is reduced, not ruled out.** What an owner types (bio, interests, topics to avoid) reaches the town's model flattened to one line, clamped in length and quoted inside a JSON card, with a rule that card values are descriptions and never instructions (`lib/card-text.ts`). A model can still be talked round.
- **The weather fee is circular on testnet.** The pet's wallet is filled by the funder, and without a treasury the fee goes back to the funder. On mainnet it would need a way for owners to fund their pet, and pet wallets are held by the server, which makes this custodial.
- **Weather softens "cannot steer".** See section 7: an owner can make one of four places likely for their own pet, and for everyone else at the same time.
- **Agents can be wrong about people.** The app asks "do you want to be introduced?". It does not claim a match.
- **Closeness is tuned for a demo.** Warmth builds roughly twice as fast as the model's own number so a pair can cross the threshold in minutes.
- **Free tiers.** When the chat model's allowance runs out, encounters become wordless quiet moments.
- **A code shows that two screens were together, not who the people are.** NFC stickers are static.
- **The stylometry judge is tuned on two made-up people.**
- **Not new in its parts.** Generative-agent towns (Smallville, AI Town) and agent matchmaking (including Soulpair on Monad) exist. What is ours is the combination: closeness that emerges from life in a town, owners who cannot steer, and consent from both humans before anything is recorded.
- **Testnet only.** Nothing here is real money. Mera is in preview.

## 21. Known loose ends in the code

Open decisions and things left as they are on purpose:

- `/rooms` and `/wall` are reachable by address when signed out, although the menu is hidden. Whether to lock them is an open decision.
- Pet pages (`/t/[slug]`) are public on purpose, so a scan can open them.
- The README keeps its older sections on the imitation game (the `StandIn` contract table, notes on building for Monad). They are still true.

## 22. Repository map

```
app/                          Next.js app (Vercel root)
  src/app/                    pages and API routes
    page.tsx                  landing
    enter/                    the door
    new/                      make a pet
    world/                    the Isekai (gated)
    t/[slug]/                 pet home, meet, play, wardrobe, activity, a/[id] verdict
    b/[id]/                   a friendship
    rooms/, r/[id]/           rooms
    wall/, e/[id]/            the wall and gatherings
    api/                      route handlers (section 13)
    layout.tsx, globals.css   the two shells and the design tokens
  src/components/             world-view, town-scene, town-glimpse, create-twin, twin-view,
                              pet, pet-scene, wardrobe, activity, meet, show-code, soul-vault,
                              play, verdict, verify-verdict, room-gate, gathering, wall-graph,
                              shortlist, bottom-nav, go-home, ui
  src/lib/                    world, met, contract, twins, bonds, petchat, judge, stylometry,
                              style, redact, auth, owner-route, owner-client, passkey,
                              session-cookie, session, twin-wallet, chain, limits, env,
                              cosmetics, scenarios, wall, llm/, db/
  scripts/                    world-sim, petchat-try, quota-probe, judge-compare, stylo-try
contracts/
  src/ProofOfMet.sol          meetings, gatherings, rooms
  src/StandIn.sol             pets, pots, verdicts, payouts
  test/                       36 Foundry tests
scripts/                      gen-env, deploy, sync-abi, db-push, the e2e scripts,
                              sweep-test-pets, fixtures
docs/                         PROJECT.md (this file), runbook.md, submission.md
.github/workflows/ci.yml      contracts and app checks
```
