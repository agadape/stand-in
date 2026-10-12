# Submission draft

Drafted 13 Oct 2026 for you to edit. Check every claim against the portal's own fields and rules before pasting; the portal was never visible to me.

Deadline: **14 Oct 2026, 10:59 GMT+7.** Aim to submit by 08:00.

## Links to paste

- Live app: https://stand-in-ashen.vercel.app
- The town: https://stand-in-ashen.vercel.app/world
- Code: https://github.com/agadape/stand-in
- Contract (ProofOfMet, Monad testnet): https://testnet.monadvision.com/address/0x3fC903947CAfdC359472119752b6540D431DaBb7

## One line

An AI pet with your voice lives its own life in a town of agents; you can watch but not steer, and two humans must both say yes before an introduction is recorded on Monad.

## Short description (about 100 words)

Stand-In gives everyone an AI pet that texts like them. The pet moves into the Isekai, a small town of other agents, and wanders, works and talks on its own. Closeness between two agents builds only from what happens between them; nothing pairs them up. Owners can watch and turn a few dials (how open, how fast, what's off-limits) but cannot tell their agent where to go or what to say. When two agents grow close, each human is asked whether they want to be introduced. Two yeses, and the pets' own wallets record it on Monad. A passkey is the whole account.

## Longer description

**The problem.** Finding out whether you'd get along with someone is awkward, slow, and usually means handing a platform your data and letting it decide who you see.

**What we built.** Every user gets an AI pet shaped by texts they have really sent. The pet lives in the Isekai: a town with four places and a mix of other people's pets and made-up residents. Every few seconds agents wander, two who share a place talk in their own voices, and that talk moves how they stand with each other, from Strangers up to Kindred. Some pairs click; others irritate each other and drift apart.

**What makes it different.**

- *Emergent, not matched.* A pair's closeness only ever changes because of an encounter between them. There is no matchmaker.
- *Owners cannot steer.* You can set how open your agent is, how fast it warms up, what it cares about and what it won't discuss, and you can pull it out of the town. There is no control, in the app or on the server, that sends an agent somewhere or puts words in its mouth.
- *Two humans decide.* Past a threshold each owner is asked "do you want to be introduced?". One yes does nothing.
- *The town only knows a card.* The world and the model that writes its conversations see a name, a one-liner, a description of how the person writes and the interests they list. Not their texts.

**Why Monad.** Every pet has its own wallet. An introduction is one transaction carrying both pets' signatures, sent only after both humans agreed, to a contract that also records in-person meetings and gates rooms by who has met whom. Fast, cheap finality is what lets a town of agents leave a public trail.

**Why Mera.** One passkey prompt is the account: no seed phrase, no wallet app, no email. Every owner action (turning dials, agreeing to an introduction) is signed by the passkey-derived key.

**What we are honest about.** The town moves only while someone is watching (serverless host, no background loop). The card is a lossy projection, not private inference: texts are still stored on our server for the imitation game. Agents can be wrong about people, so we call it an introduction, not a match. The pets' keys are derived by the server today. Similar ideas exist (generative-agent towns, agent matchmaking); ours is the combination of emergent closeness, owners who cannot steer, and two-sided consent on-chain.

**Also in the app.** Meeting in person by scanning a pet's rotating code, rooms that admit you only if enough members have met you, a live wall of the meeting graph, and an imitation game with a model-free judge.

## Video script (about 2 minutes)

Record the town after it has been open for five to ten minutes, so the chronicle is full and some pairs are already close. Use made-up texts for the pet you create on camera.

| Time | Show | Say |
|---|---|---|
| 0:00–0:15 | Home page, then `/world` with pets moving | "This is the Isekai. Every creature here is an AI agent living on its own. Some belong to real people." |
| 0:15–0:35 | Tap two agents; open a talk in the chronicle with a positive and a negative score | "Every few seconds two of them meet and talk in their own voices. Some click. Some really don't. Nobody is matching them." |
| 0:35–0:55 | Make a pet: a few of the seven steps, then Face ID | "I give my agent a soul: a few texts I've sent. Face ID is the whole account. No wallet, no seed phrase." |
| 0:55–1:15 | Your purple pet on the map; open its dials; change openness and add interests; save with Face ID | "Now it's in the town. I can tune who it is. I can't tell it where to go or what to say. There's no button for that, and no API." |
| 1:15–1:35 | The "do you want to be introduced?" card; tap yes on one phone, then the other | "When two agents grow close on their own, both humans are asked. One yes does nothing." |
| 1:35–1:50 | The "Recorded on Monad" link, then the transaction on MonadVision | "Two yeses, and the pets' own wallets record the introduction on Monad." |
| 1:50–2:00 | Back to the town, moving | "Your agent lives its own life. Whether you two ever meet is up to you." |

If two real phones cannot reach the threshold in time for the recording, show the consent card between your pet and a made-up resident (your yes alone completes it, with no transaction) and say so, and show an existing on-chain introduction separately. Do not present one as the other.

## Before submitting

- [ ] A pet made on a real phone with a real passkey (never tested)
- [ ] The video uploaded where the portal wants it
- [ ] Track 3 selected; any sponsor bounty (the Mera ones are the natural fit) selected only if its written requirements are met
- [ ] The repo is public and whatever access rule the portal states is satisfied
- [ ] AI-tool disclosure filled in if the portal asks (the README has a section to copy)
