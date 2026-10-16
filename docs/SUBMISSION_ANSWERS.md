# Devfolio submission answers (draft)

Copy-paste source for the Devfolio form. `[FILL]` marks anything not yet true or not yet known.
Nothing here is submitted automatically; the builder submits and publishes.

Judging (docs/scoring-rubric.md in the challenge repo): four criteria, 25 points each. For each track, its own first
criterion ("Why India?" or "Why this pillar?") plus **Why Arkiv**, **How you use Arkiv** and the **Friction report**.
Each answer below is written to the rubric's top band, and every claim links to something a judge can open.

## Public fields

- **Project name:** Tolmol (तोलमोल)
- **Tagline:** A complaint anyone can make in a few taps, read aloud in Hindi, on a record nobody can edit or delete: ration, mid-day meals, MGNREGA wages. Built on Arkiv.
- **Tracks:** Best Indian Use Case, Censorship Resistance, Open Source, Privacy, Security
- **Technologies:** Arkiv (Tiramisu), @arkiv-network/sdk 0.8.1, viem, @noble (secp256k1, AES-GCM), TypeScript, Preact, Vite, Vitest, Node.js, Python (reader)
- **Platforms:** Web (mobile-first, installable, offline), CLI
- **Media:** `docs/media/hero-v3.jpg`, `voice-v2.jpg`, `arch.jpg`, `schemes-v2.jpg`, `trust-v2.jpg`
- **Links:** repo https://github.com/amannx21/Tolmol · app https://tolmol-web-kappa.vercel.app · backup
  https://amannx21.github.io/Tolmol/ · video [FILL]

### The problem it solves * (this is also our "Why India?")

*An illustration (synthetic, like all our data).* At a ration shop in Gaya, a woman with an Antyodaya card is owed
35 kg. The scale says 35; she carries home 31. If she complains, it is her word against the dealer she depends on
every month, on a portal that can lose it, in a WhatsApp group whose admin can delete it.

**Who, in India.** 81.35 crore people get free grain at more than 5 lakh fair-price shops (NFSA 2013: 5 kg a person,
35 kg for an Antyodaya family), and about 28% of PDS grain never reaches them (ICRIER). Parents of children on PM
POSHAN mid-day meals and MGNREGA workers face the same thing: a fixed amount owed at a known place, and the only
record (ePoS slip, meal register, muster roll) kept by the side they would complain about.

**Today.** One person's word against the outlet's, records that can be edited or lost, and nobody who can see the
pattern across a shop or a district. And complaining is itself hard: forms, logins, typing, English, an office visit.

**Built for the person at the counter, not for a computer user.** If she can tap and listen, she can complain: every
question is read aloud in Hindi, every answer is a big button or a + / − step, and there is nothing to type, no
form, no sign-up and no app to install. Weak signal is fine: the report waits on the phone and sends itself.

**What changes from day one.**
1. **She reports in under a minute, out loud in Hindi.** One question per screen, read aloud by the phone's own voice,
   big buttons and + / − steps; no typing, no name, no card number, no account. It works offline and sends when there
   is signal. School meals and wages work the same way.
2. **Neighbours back her, or say otherwise.** Others at the counter tap "I got less too", or "I got my full ration".
   A lone claim that 3 others contradict is labelled so; it is never hidden.
3. **The dealer answers on the record.** A verified dealer, head teacher or employment assistant sees their waiting
   reports first, answers from a fixed list, and posts a monthly board that Tolmol sets against the reports ("about
   752 kg is unaccounted for"). Only she can say "fixed" or "not fixed".
4. **Officials act, and are watched.** A public "needs attention" list, recorded actions, inspectors whose authority
   covers one outlet for a few days, and a public track record that flags a "no issue found" when later reports
   contradict it.
5. **She is never exposed.** What she cannot say in public goes in a private note only the district official can
   read. If she must prove "this report is mine", she can send the proof through someone she trusts instead of going.
6. **It reaches the right desk.** Printable complaints to the District Grievance Redressal Officer (NFSA s.15), the
   District Education Officer or the MGNREGA Programme Officer and Ombudsperson, an RTI, the state's food helpline,
   and a letter above the inspector to the State Food Commission when an inspection is contradicted.

**It works today:** live in Hindi and English at the links above, installable, offline. The demo uses synthetic shops,
schools and panchayats in real districts of Bihar, Uttar Pradesh and Jharkhand. Real use needs one change: a state
department's registry key instead of ours, which the app already supports (`#/trust`).

### Challenges I ran into *

- The anonymous query budget (10,000 units, 100 per query, up to about an hour to reset) is invisible until it is gone,
  and viem silently waited out `Retry-After`, so reads looked like hangs. We fail fast, show each query's `Arkiv-Cost`
  and the reads left, and serve a labelled saved copy when the budget runs out (friction F13, F14).
- The public RPC rejects request bodies over 262,144 bytes, reported as "Execution error without revert data"; we
  probed the HTTP 413 directly and cap batches at 40 creates (F5).
- On Arkiv the owner can delete even a read-only entity, so a pressured reporter could delete evidence. We solved it
  without contracts: create + transfer to a burn address in one atomic batch, using predicted keys.
- Privacy and public evidence pull in opposite directions. We kept every number public (so anyone can recount a shop)
  and encrypted only the one thing meant for one person, a note to the official, to a key that proves itself:
  it must hash to the official's `$creator`.
- Anonymity needed more than "no names": exact MGNREGA wages could name a worker on the public muster roll (we round
  to ₹500), a report landing right after a visit can be matched by time (random send delay), and one phone's
  confirmations could be linked across shops (one ID per outlet).

### Why this pillar? (one paragraph per track, if the form asks)

- **Censorship Resistance.** *Who is censored today:* a card holder, parent or worker whose complaint disappears when a
  portal, a WhatsApp admin, the dealer's friends or the app's own host remove it, and the auditor who never sees the
  pattern. *From day one:* every report, confirmation, answer, board and official action is sealed on Arkiv (readonly,
  handed to `0x…dEaD` in the creating batch): nobody, including us, can edit or delete it. *The pillar's ask, "someone
  outside the team can read and query the data from Arkiv without the team's backend":* there is no backend to remove.
  `#/raw` gives every query the app makes as curl, JavaScript or Python; the README's curl, a standard-library Python
  reader, the one-file `mirror.html` (any Arkiv RPC) and `examples/build-on-tolmol.mjs` all read Arkiv directly and
  apply the same rules. The site runs on two hosts, takes any Arkiv endpoint, works offline, shows a labelled saved copy
  if the read budget runs out, and anyone can switch the trusted registry. **Even filing does not need us:** with the
  CLI, anyone can file or confirm a report from their own computer with gas from the public faucet, so blocking our
  site or our relayer does not stop a complaint.
- **Open Source.** *Who is locked out today:* civic groups, journalists and other states, who need a separate permission
  and integration for each portal's data. *From day one, and the pillar's ask, "another team can build on the dataset
  or tool without asking permission, from a documented data contract":* MIT; `arkiv/schema.md` and all 16 record types
  as JSON Schema (`docs/data-contract.schema.json`); `tolmol-sdk` on npm with a changelog where every change is
  additive [FILL: 0.2.0 once published]; a CLI that reads, files and confirms; a Python reader written only from the contract;
  **`examples/build-on-tolmol.mjs`: every outlet's verdict and every inspector's track record for a state in about 25
  lines, with no key and no Tolmol server**; and a daily public check that what is on chain still matches the
  contract. The proof it is reusable: mid-day meals and MGNREGA wages were added on the same model without changing a
  single ration record or breaking the published reader.
- **Privacy.** *Who is exposed today:* a person who complains about the dealer, head teacher or panchayat they depend
  on every month, and can be scolded, refused work or have their card kept. *From day one, point by point against the
  pillar's ask:*
  **No personal data on the explorer:** no name, phone, Aadhaar, card or job card number, or child's name, not even
  hashed; `#/public` shows a real report exactly as a stranger sees it, beside everything that never left the phone.
  **Few attributes, each earning its place:** a ration report is 16 small typed fields and nothing else, each there
  because a reader filters or ranges on it (the rubric's "numbers where you need ranges"): the outlet and its place (3),
  the month and its number (2), the item, the amounts owed and received with the shortfall in grams and basis points
  (4), a bitmask of what went wrong, the day (not the time), and four tags (project, type, version, synthetic). No free
  text, no household-size field; MGNREGA wages rounded to ₹500. **Encrypted payloads:** every payload is empty except a
  **private note to the district official**, encrypted on the phone with standard ECIES (secp256k1, HKDF-SHA256,
  AES-256-GCM; a test proves Node's own OpenSSL opens it) to a key that must hash to that official's `$creator`. The
  explorer shows ciphertext, the daily audit fails on anything else, and the note box refuses phone, Aadhaar and card
  numbers, because ciphertext outlives the note in chain history. **Expiry the user controls:** 30, 90 or 180 days,
  and whether neighbours may extend it. *Beyond the ask:* a separate anonymous ID with one tap, switched on by itself for
  the reports a dealer would retaliate against (threats, a kept card, bribes, discrimination), and one ID per outlet for
  confirmations; a random send delay of 1 to 6 hours; a small-outlet warning; a hearing proof that writes nothing and
  can be sent through someone trusted. The audit of every Tolmol entity runs daily in public (GitHub Actions, PASS).
  *A trade-off we state, not hide:* ordinary reports use the phone's usual ID unless separate IDs are on, so "one report
  per phone" can still be checked on chain. Honest limits (threat model T36, T48, T51, T56): the amount owed can hint at
  family size, block times are public, and that a note exists is public, not its words.
- **Security.** *Who is misled today:* officials, journalists and card holders who act on records that can be forged
  ("all fixed", "full ration given") or quietly withdrawn, and on inspections that can be bought. *The pillar's ask,
  "shows or filters entities by `$creator`, not by a field anyone can write", everywhere:* outlets only from the
  registry; answers and boards only from the outlet's verified operator; "fixed" and withdrawals only from the reporter;
  official actions only from that district; inspector findings only for the delegated outlet inside its window;
  private notes only from the report's own key, to an office key that must hash to its `$creator`; "I got my full share"
  once per `$creator` per month. Planted fakes (a fake dealer answer and a fake "fixed", at a shop and a school) are
  shown as ignored, with their writers. *Who checks the checkers:* every finding is set against the reports that follow
  it; the demo inspector's "no issue found" at SYN-BR-0002, followed by reports 31% short, is flagged on the public
  track record (`#/track`) under the inspector and the official who sent them. *Where we stop, said plainly:* one person
  with many phones is the open problem every entry shares. Tolmol makes it visible instead of pretending: burst patterns
  on every outlet, a one-tap verified-only view on the dashboard, one card verifies one phone. The demo's test cards are
  public on purpose so judges can act as any role; a state would issue real ones (DigiLocker design,
  `docs/VERIFIED_REPORTERS.md`), and the registry that names verifiers is replaceable (`#/trust`) and can name several.
  Every number is recomputed by every reader, an edited evidence file fails the Verify page, and the registry address
  is checked against this repository. 121 tests, CodeQL, and two real relayer bugs found and fixed (IP spoofing, a
  429 hang).

## Organiser questions (private to judges)

1. **Live app URL** \*: https://tolmol-web-kappa.vercel.app (public, no login; the same build is on GitHub Pages at https://amannx21.github.io/Tolmol/)
2. **Indian nationality** \*: Yes (AMAN ARORA)
3. **Why Arkiv?** \*

   What Tolmol builds on Arkiv is **a chain of trust that nobody can step outside, officials included**. A registry
   names verifiers; verifiers vouch for card holders, dealers, head teachers and officials; officials send inspectors for
   a few days; and every one of them is held to account by records written later by the people they serve: a dealer's
   "fixed" by the reporter, an inspector's "no issue" by the next month's reports. Every link is an Arkiv entity, and
   the only thing that makes a link count is who wrote it. **Without Arkiv it falls apart**, because it needs three
   properties together. (1) **Authorship set by the protocol** (`$creator`): every rule hangs on it, down to an
   official's encryption key, which proves itself by hashing to its `$creator`. A field anyone can write would make all
   of it forgeable; our own signed API would still let us choose what to serve. (2) **Records nobody can delete**,
   without a contract: `readonly` plus an ownership transfer to `0x…dEaD` in the same atomic batch. On Postgres behind
   our API, we, our host or anyone who pressures us could delete a complaint and nobody outside could tell. (3)
   **Queries with no operator**: anyone can ask "every report at this school in October" or "everything about this
   shop, in one query" over typed attributes. IPFS keeps content but needs an indexer someone runs; a subgraph needs a
   contract, an indexer and its operator. Expiration (lifetimes the reporter chooses, inspector windows that end by
   themselves), Extension (neighbours keep evidence alive) and `atBlock` (what was public at block N) complete it.
   **Even we are replaceable:** a state can point the app at its own registry (`#/trust`), anyone can read everything
   with curl, and anyone can file a report from their own computer with the CLI, without our website or our relayer.

   **Kept off Arkiv on purpose:** names, phones, Aadhaar, ration card and job card numbers, children's names,
   addresses (hashes would be reversible), free text, photos, household size as a field, the exact time (rounded to the
   day), exact MGNREGA wages (rounded to ₹500), the words of a private note (only ciphertext goes on chain), an
   official's private key, proofs of authorship (checked in person, never stored), device keys, the relayer's
   rate-limit data and IPs, and aggregates (anyone can recompute them).

4. **How do you use Arkiv?** \* We judge ourselves by how and why, not how many. **Five features Tolmol could not exist
   without**, each chosen for a reason the user sees:

   1. **`$creator` as the only trust rule.** Answers, boards, "fixed", withdrawals, official actions, inspector
      findings, private notes and published keys count only from the right wallet. *User sees:* "2 answers or
      follow-ups ignored", with who wrote them; "Private notes for you" only on the real official's phone.
   2. **Readonly + ownership transfer to `0x…dEaD` in one atomic batch** (`predictEntityKeys`). *Why:* on Arkiv an owner
      can delete even a readonly entity, so a pressured reporter could be made to. *User sees:* "Sealed: nobody can edit
      or delete it, including us".
   3. **Typed attributes and compound, range and `OR` queries, read by anyone.** Grams, days and rupees as numbers so
      the dashboard can range on them; one `OR` query reads every shop, school and panchayat from the registry; the
      payload stays empty except a note's ciphertext. *User sees:* rankings by district and month, and `#/raw` with
      every query as curl.
   4. **Entity Expiration as product logic.** The reporter chooses 30, 90 or 180 days; an inspector's authority ends at a
      block by itself; a private note lives 180 days. *User sees:* the expiry choice, and days left on every report.
   5. **Lifetime Extension as a lease renewed by neighbours.** The second confirmation extends the report and its
      witnesses (`permissionlessExtension`, read back so a reporter's opt-out is respected). *User sees:* the expiry
      moving out when neighbours confirm.

   With the same care: `atBlock` history ("show as it was at block N"), WebSocket `watchEntityEvents` with no
   `fromBlock` (the live dashboard), block numbers as evidence (a finding judged by the reports after its block), the
   owner kept on purpose so an official can revoke an inspector, `createdBy()` to stop repeats, and the `Arkiv-Cost` /
   `RateLimit` headers shown to the user. Every feature, with a permalink to the exact lines (49 in all):
   https://github.com/amannx21/Tolmol/blob/submission-v1/docs/ARKIV_USAGE.md

5. **Friction report** \*: https://github.com/amannx21/Tolmol/blob/submission-v1/arkiv/friction.md (14 issues, each
   with versions, expected vs actual, steps to reproduce and the fix; plus the paths we tested that worked)
6. **Wallet addresses** \* (full list with roles: https://github.com/amannx21/Tolmol/blob/submission-v1/arkiv/wallets.md):
   - `0x6DBf6A36E27d814c58A05312913DCEEfc0dAe221`: registry: creates every synthetic shop, school and panchayat, and names the verifiers
   - `0x1C58335A9C5c5a3440f8018984cf9069b7C9408B`: card verifier: creates the verification attestations
   - `0xFdbFff21C655c698a69205D2eb5Ec73a2F2d2dE6`, `0x40885B892dFbc317F9ffb7b5A410e9E8f00406e0`: demo dealers (answers, stock boards)
   - `0xC29C54165B368C42E1263b675286aBd3DCfDCf0A`, `0xff2343feCC600f8A68DF60376334C68B3eA3a114`: demo head teacher and employment assistant (answers, meal and work boards)
   - `0x20e2B6010a4a9128EAEDea408B29A4AC5a44a410`: demo Gaya official (actions, delegation, key for private notes); `0xDa4c041B4A1ec3825D6Fb389bfda91DBEC1188E6`: delegated inspector (the contradicted "no issue found")
   - `0xAe8DCc161d9F27fACFE6D48A8B4DF148D64ab9E3`, `0xA7EF19b057E28BcB7048a202992423Da937Df140`: witnesses in tests
   - `0xDAD092E626A158220Aa2838d25CCD69F51de76BE`: reporter in tests, funds the demo wallets; 10 synthetic seed devices and the synthetic phones of `scripts/seed-trust-demo.ts` file reports, confirmations, a private note and "I got my full share" (listed in wallets.md)
   - `0x357A30b18BF4020F243186d76dBdD44b830119e2`: relayer, sends test-GLM drips only, never creates Tolmol entities
   - Real visitors' phones create their own wallets in the browser: read `creator` from any query
7. **Schema** \*: https://github.com/amannx21/Tolmol/blob/submission-v1/arkiv/schema.md
8. **How judges can reproduce** \* (app: https://tolmol-web-kappa.vercel.app). *Note:* Arkiv gives each anonymous
   visitor about 100 queries an hour; the footer shows how many are left, and pages fall back to a labelled saved copy
   if they run out. These seven steps fit well inside it:
   1. **Without our app:** run the curl in the README, open `#/raw` and copy any query as curl, JavaScript or Python, or
      run `node examples/build-on-tolmol.mjs BR`. Every report has `owner = 0x…dEaD`.
   2. **Report in Hindi** (`#/report`): each question read aloud, big + / − buttons, then "what becomes public". On your
      own report at a Gaya outlet, the private-note box encrypts to the Gaya official; its explorer link shows only
      ciphertext.
   3. **`#/shop/SYN-BR-0042`:** the stock board against card holders' reports ("about 752 kg unaccounted for"), "2
      answers or follow-ups ignored" (planted fakes, written by strangers' wallets), the score card, officials' actions,
      and "Show as it was at block".
   4. **`#/track?state=BR`:** the demo inspector's "no issue found" at SYN-BR-0002 flagged "contradicted by later
      reports"; on that shop's page, "Complain about this finding" drafts the letter to the State Food Commission.
   5. **The lone claim at SYN-BR-0004** (`#/r/0xc4e04f15b6d787d8c1e434afd9312d47c2b70993db0c18703e93eabcc7ac7fe3`):
      "3 others at this outlet say they got their full share", "Contradicted by 3 others".
   6. **`#/public`:** a real report and a real private note exactly as a stranger sees them, and the latest daily audit
      (PASS).
   7. **`#/test-cards` → "Who are you?":** pick a dealer licence; the phone gets "My shop" and the reports waiting first.

   More, if you have time: the mid-day meal and MGNREGA bar under the menu (`#/shop/SYN-BR-5001`, `#/shop/SYN-BR-7001`),
   `#/proof` (prove a report is yours), `#/verify` ("Tamper with a copy and check it"), `#/trust`. From a clone:
   `npm ci && npm test` (121 tests), `node --import tsx scripts/privacy-audit.ts` (PASS), and
   `npm run tolmol -- submit …` to file without our site (README, "Report even if our site is blocked").
9. **Pre-existing work** \*: None. Baseline commit `0902494` contains only GitHub's generated LICENSE and .gitignore.
10. **Arkiv surfaces used** \*: TypeScript SDK, Direct JSON-RPC, WebSocket events, Docs, Hub, Faucet, Block Explorer.
    (Arkiv skills: read as reference, not installed.) See `docs/SURFACES_USED.md`.
11. **Other surface**: none
12. **First Arkiv entity** \*: 2 hours or less (first entity at 2026-10-13 08:47:24 UTC, 24 min after starting; `docs/BASELINE.md`)
13. **LLMs used** \*: Claude (Anthropic) via Claude Code. See `docs/LLMS_USED.md`.
14. **One thing Arkiv should improve first** \*: Make the anonymous read budget visible before it runs out. With budget
    left, the `RateLimit` header shows only the per-minute window and `Arkiv-Quota-Used-Percent` is never sent, so an
    app learns about the 10,000-unit budget only from the 429 that ends it, and viem then silently waits out a
    `Retry-After` of up to an hour (friction F13, F14). Sending the budget on every response, and typed errors in the SDK,
    would have saved us hours and would let apps warn users in time.
15. **Feedback call** \*: [FILL: builder's choice]
16. **Our work, built 9 to 18 Oct, disclosed** \*: Yes. Third-party demo pictures are credited in `docs/PHOTO-CREDITS.md`.
17. **Repo public under MIT, links accessible** \*: Yes ([FILL: re-check in an incognito window before submitting])
18. **Attending Devcon 8**: [FILL: optional]
