# Rules digest: Arkiv Global Tour Stop

Source: https://github.com/Arkiv-Network/global-tour-stop-pre-devcon at commit
`7eb4e1cafe65892e7f52b2b33fe362357327aa90` (2026-10-07), read on 2026-10-13.
Files read in full: README.md, RULES.md, AGENTS.md, CLAUDE.md, docs/scoring-rubric.md,
docs/submission-checklist.md. The Devfolio page (https://arkiv.devfolio.co/overview) was
also read on 2026-10-13. It matches the repo on dates, tracks, prizes, gates, network and SDK.

**Precedence.** RULES.md says the Devfolio page is the official source, and the repo
follows it. If they differ, Devfolio wins.

**Draft banner.** README.md and RULES.md still carry a "Draft, frozen on 9 October" note.
The last repo commit is 7 October, so the text we read is the frozen version. Any later
change can only arrive as a dated clarification, announced on Devfolio and Discord.

## Dates (London time, BST = UTC+1)

| When | What |
|---|---|
| 9 Oct 12:00 | Challenge opens |
| **18 Oct 23:59 (22:59 UTC)** | Submissions and registration close. Late entries rejected |
| 19 to 22 Oct | Judging |
| 23 Oct 18:00 | Winners announced. **Deployment must stay up until then** |
| 25 Oct | Winners accept within 48 h of the email |

At the deadline the organisers record the repo's commit SHA and judge that commit.
Rewriting history after the deadline disqualifies the entry.

## Eligibility that affects us

- Team of 1 to 5. Roster freezes at the deadline. All members 18+.
- Best Indian Use Case needs at least one team member of Indian nationality. It is
  declared at registration and again on the submission form. KYC is done with that person.
- One prize per team. Best Indian Use Case is allocated first. A team that wins it cannot
  win a Global prize.
- Minimum 50/100 to win.

## Gates (fail any one and the project is not scored)

1. Works: public deployment on Tiramisu, usable without asking for access.
2. Reproducible: steps and the **exact query** that produce what the submission claims.
3. Public repo, MIT licence, setup instructions in the README.
4. `/arkiv/schema.md`: entity types, attributes, expiration per type, the queries the app runs.
5. On-chain evidence: the wallet addresses that create the entities on Tiramisu.
6. `/arkiv/friction.md`.
7. Demo video, 3 minutes or less.
8. Every required Devfolio question answered.
9. At least one track chosen on Devfolio.
10. Built 9 to 18 Oct 2026. Pre-existing work disclosed with baseline SHA and reused components.
11. Evidence that survives expiry: if entities expire before judging, judges use creation
    transactions on the explorer and the demo video.

## Disqualifiers

- No meaningful Arkiv use: SDK installed but never queried, or a Postgres app with an Arkiv logo.
- Private keys or secrets stored in Arkiv.
- Real personal data in Arkiv, plaintext **or hashed**. Hashes of emails or phones are
  reversible. Synthetic data is required. Encrypted payloads of test data are allowed.
- Plagiarism, malicious code or deliberate vulnerabilities.
- No working app, or a late submission.
- Arkiv must be the **primary data layer**, through `@arkiv-network/sdk` 0.8.x or direct RPC.

## Scoring (100 points, 4 criteria x 25)

Each criterion is scored 0 to 5, then `points = 25 x score / 5`.
Score 5 means "specific enough that another builder could follow it".

| Criterion | What earns a 5 |
|---|---|
| Why India? (our primary track) | Names who in India uses it, what changes for them, and the app works for them today |
| Why this pillar? (scored per CROPS track entered) | Names who is censored, exposed or misled today and what changes from day one |
| Why Arkiv? | The project falls apart without the Arkiv property it relies on, **and** says what deliberately stays off Arkiv |
| How you use Arkiv | Every feature used changes something the user sees, and the team explains why. Judges check chain and code: a claimed feature that is missing counts against you |
| Friction report | Each issue has expected vs actual, versions, repro steps and a suggested fix. A smooth path documented with the same rigour scores the same. **Invented complaints score 0** |

What each pillar we enter asks for:

- **Censorship Resistance:** someone outside the team can read and query the data from Arkiv without the team's backend.
- **Open Source:** another team can build on the dataset or tool without permission, from a documented data contract.
- **Security:** the app shows or filters entities by on-chain `$creator`, not by a field anyone can write.

Features the rubric names under "How you use Arkiv": typed attributes vs payload, compound
queries with ranges, `createdBy()`/`ownedBy()`, cursor pagination, per-type Entity Expiration,
`extendEntity` as a lease renewed by activity, creation flags such as permissionless
extension, `$creator`/`$owner` in the UX, `watchEntityEvents` over WebSocket with no
`fromBlock`, and atomic batch writes.

Tie-breaks: higher Why Arkiv, then higher How you use Arkiv, then earlier submission.

## Instructions for AI agents (AGENTS.md, which CLAUDE.md points to)

These apply to builders and we follow them:

- Say "Entity Expiration" and "Lifetime Extension". **Never say TTL.** Call Arkiv
  "the Web3 database" and its records "Arkiv entities".
- Ask the builder, before coding: the track and who is helped; why Arkiv and what stays off
  it; a funded test wallet (key in an env var, never in chat or code); the entity types and
  the 2 or 3 questions the app must answer.
- Write `/arkiv/schema.md` and keep `/arkiv/friction.md` updated while building.
- Before the deadline, help draft the Devfolio answers.
- SDK hard rules: no server-side ordering, max 200 per page, ranges only on numeric
  attributes, payload not queryable, everything expires, `extendEntity` **sets** a new expiry,
  trust comes from `$creator`, WebSocket transport needed for real live events, all
  entities are public.

## Where AGENTS.md disagrees with the installed SDK

| AGENTS.md says | SDK 0.8.1 and docs say | Our choice |
|---|---|---|
| "range-filter on `$createdAt`" | The query builder rejects `$createdAt`. Only `$key`, `$owner`, `$creator` and `$expiresAt` are filterable (`src/query/expression.ts`). The skills repo says raw RPC accepts it | Store our own `reported_at` as `u64` and range on that |
| Live events need a WebSocket transport | The docs page on live events only shows `http()` and says it polls | Use `webSocket()` with no `fromBlock`. The SDK passes through to viem `watchEvent`, so this should subscribe. To be tested on chain |

## Notes on the brief vs the sources

- The brief says expiry uses `ceil(seconds / 2)`. SDK 0.8.1 does not round: a duration that
  is not a multiple of 2 seconds throws `InvalidExpiryError`. Only `atDate()` rounds up.
  We will use `fromDays()` or `fromBlocks()`, which are always whole blocks.
- The docs say a lifetime has no upper bound except u64 (`ExpirationTime.permanent()`).
  The minimum is "after the block the transaction lands in". Both still need an on-chain test.
- The brief asks for `/arkiv/wallets.md`. The rules do not require that file, only that
  the addresses appear in the submission. We add it anyway, plus a README section.
- The rules give no fixed format for `schema.md` or `friction.md`, only required content.
