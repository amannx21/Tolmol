# Devfolio submission answers (draft)

Copy-paste source for the Devfolio form. `[FILL]` marks anything not yet true or not yet known.
Nothing here is submitted automatically; the builder submits and publishes.

Judging (docs/scoring-rubric.md in the challenge repo): four criteria, 25 points each. For each track, its own first
criterion ("Why India?" or "Why this pillar?") plus **Why Arkiv**, **How you use Arkiv** and the **Friction report**.
Each answer below is written to the rubric's top band.

## Public fields

- **Project name:** Tolmol (तोलमोल)
- **Tagline:** A tamper-proof record of what people are owed and what they get: ration, school meals and MGNREGA wages. Built on Arkiv.
- **Tracks:** Best Indian Use Case, Censorship Resistance, Open Source, Privacy, Security
- **Technologies:** Arkiv (Tiramisu), @arkiv-network/sdk 0.8.1, viem, TypeScript, Preact, Vite, Vitest, Node.js, Python (reader)
- **Platforms:** Web (mobile-first, installable, offline), CLI
- **Media:** `docs/media/hero-v3.jpg`, `voice-v2.jpg`, `arch.jpg`, `schemes-v2.jpg`, `trust-v2.jpg` (older: `dashboard-en.jpg`, `dashboard-hi.jpg`, `shop-page.jpg`, `report.jpg`)
- **Links:** repo https://github.com/amannx21/Tolmol · app https://tolmol-web-kappa.vercel.app · backup
  https://amannx21.github.io/Tolmol/ · video [FILL]

### The problem it solves * (this is also our "Why India?")

**Who, in India.** 81.35 crore people get free grain at more than 5 lakh fair-price shops (NFSA 2013: 5 kg a person,
35 kg for an Antyodaya family). About 28% of PDS grain never reaches them (ICRIER). The same pattern hits children's
school meals (PM POSHAN) and MGNREGA workers' wages: the person is owed a fixed amount at a known place, and the
only record (the ePoS slip, the meal register, the muster roll) is kept by the side they would complain about.

**Today.** When a card holder gets 4 kg instead of 5, a child gets no meal, or wages come short, it is their word
against the dealer's, the school's or the panchayat's. Complaints on a portal, a helpline or a WhatsApp group can be
lost or deleted, and nobody sees the pattern across a shop or a district.

**What changes from day one with Tolmol.**
1. The person reports in under a minute on a cheap Android phone: one question per screen, read aloud in Hindi, big
   buttons and + / − steps instead of typing (Easy mode); helpers, journalists and auditors use Full mode. No name, no
   card or job card number, no account. A reporter who made a mistake can withdraw their own report, on the record.
   They also say what else went wrong (asked to pay, fingerprint failed, card kept, children made to sit apart, wages
   later than 15 days, job card kept), with no free text.
2. Others at the same shop, school or panchayat confirm it from their own phones.
3. The verified dealer, head teacher or employment assistant answers on the record from a fixed list, and the reporter
   says whether it was really fixed. They also post a monthly board (stock, meals, wages paid), and Tolmol sets it
   against the reports: *"N card holders say they got X% less this month; applied to the kg on the board, about Y kg
   is unaccounted for"* (shown as an estimate from a sample, not an audit).
4. District officials see a public "needs attention" list, record what they did, and can send an inspector whose
   authority covers only that shop for a set number of days.
5. The person prints a complaint to the right office (District Grievance Redressal Officer under NFSA s.15, District
   Education Officer, MGNREGA Programme Officer and Ombudsperson) or an RTI, calls their state's food helpline, and at a
   hearing can prove "this report is mine" without anything about them becoming public, even without going, through
   someone they trust. If an inspector clears a shop and complaints continue, the finding is flagged and a letter to
   the authority above (State Food Commission, District Magistrate, MGNREGA Ombudsperson) is one tap away. Journalists and social-audit
   groups rank the worst outlets, see any outlet as it was at a past block, and download evidence with an explorer
   link per row.
6. A shop that fixes things earns a "Fair shop" badge from the evidence, which lapses on its own if things get worse.

**It works today.** Live at the link above, in Hindi and English, installable and usable offline (reports wait on the
phone until there is signal). The demo uses synthetic shops, schools and panchayats in real districts of Bihar, Uttar
Pradesh and Jharkhand, as the rules require. Real use needs one change: a state department's registry key instead of
ours, which the app already supports (the Trust page lets anyone choose the registry).

### Challenges I ran into *

- The anonymous query budget (10,000 units, 100 per query, up to about an hour to reset) is invisible until it is gone:
  with budget left, the `RateLimit` header shows only the per-minute window. Reads looked like hangs because viem
  waited out `Retry-After`. We now fail fast, show each query's `Arkiv-Cost` and the reads left, and serve a labelled
  saved copy when the budget runs out (friction F13, F14).
- The public RPC rejects request bodies over 262,144 bytes, reported as "Execution error without revert data"; we
  probed the HTTP 413 directly and cap batches at 40 creates (F5).
- On Arkiv the owner can delete even a read-only entity, so a pressured reporter could delete evidence. We solved it
  without contracts: create + transfer to a burn address in one atomic batch, using predicted keys.
- Extension events report the owner, not the wallet that extended, so confirmations are counted from witness
  entities by `$creator` instead.
- Keeping complainants anonymous needed more than "no names": MGNREGA muster rolls are public, so exact wages could
  name a worker (we round them); a report landing right after a shop visit can be matched by time (we offer a random
  send delay); the entitlement can hint at family size (we say so before sending).

### Why this pillar? (one paragraph per track, if the form asks)

- **Censorship Resistance.** *Who is censored today:* a card holder, parent or worker whose complaint disappears when a
  portal, a WhatsApp admin, the dealer's friends or the app's own host remove it, and the auditor who never sees the
  pattern. *From day one with Tolmol:* every report, confirmation, answer, board and official action is sealed on Arkiv
  (readonly, handed to `0x…dEaD` in the creating batch), so nobody, including us, can edit or delete it. Anyone outside
  the team reads it without our backend (there is none): `#/raw` gives every query the app makes as curl, JavaScript or
  Python; `examples/tolmol_reader.py` (standard library only) and the one-file `mirror.html` (any Arkiv RPC) apply the
  same rules; the CLI does too. The site runs on two hosts, takes any Arkiv endpoint, works offline, shows the last good
  copy if Arkiv's read budget runs out, and anyone can switch the trusted registry.
- **Open Source.** *Who is locked out today:* civic groups, journalists and other states' projects, who need a
  separate permission and integration for each portal's data. *From day one:* everything is MIT, with a documented data
  contract (`arkiv/schema.md`, and `docs/data-contract.schema.json` for all 13 entity types); `tolmol-sdk` on npm
  (0.1.0 published; 0.2.0 adds a reusable Arkiv read transport for any browser app [FILL: when published]), a CLI, a
  Python reader written only from the contract, a daily public check that every entity on chain still matches the
  contract, and a changelog in which every change is additive. The proof that it is reusable: we added two more
  schemes (school meals, MGNREGA wages) on the same model without changing a single ration record or breaking the
  published 0.1.0 reader.
- **Privacy.** *Who is exposed today:* a person who complains about the dealer, head teacher or panchayat they depend on
  every month, and can be scolded, denied work or have their card kept. *From day one:* the explorer shows no personal
  data: no name, phone, Aadhaar, card number, job card number or child's name, not even hashed; payloads are empty (there
  is nothing to encrypt, because nothing private is sent); a ration report has 16 small attributes with the time
  rounded to the day; the reporter chooses the expiry (30, 90 or 180 days) and whether others may extend it. Before
  sending, a box shows what becomes public. A separate anonymous ID per report (automatic for threats, a kept card,
  bribes, discrimination), a random send delay of 1 to 6 hours, a small-outlet warning, MGNREGA wages rounded to ₹500
  (muster rolls are public), and a proof of authorship that writes nothing and can be sent through someone the reporter trusts, so they never have
  to appear. A public audit checks every
  Tolmol entity on Tiramisu (PASS), and a GitHub Action reruns it daily. Honest limits (threat model T36, T48): the
  entitlement can hint at family size, and block times are public.
- **Security.** *Who is misled today:* officials, journalists and other card holders who act on records that can be
  forged ("all fixed", "full ration given") or quietly withdrawn. *From day one:* every count filters by on-chain
  `$creator`, never by a field anyone can write: outlets only from the registry; answers and boards only from the
  outlet's verified operator; "fixed" and withdrawals only from the reporter; official actions only from an official of
  that district; an inspector's findings only for the delegated outlet inside its window. Planted fakes (a fake dealer
  answer and a fake "fixed", at a shop and at a school) are shown as ignored, with their writers. The registry address is
  checked against this repository from the Trust page; a custom registry shows a warning on every page. Every number is
  recomputed by every reader, a tamper test catches an edited evidence file, burst patterns flag sybil filing, and
  phones can be verified (one card, one phone). Officials and inspectors are checked too: every finding is set against
  the reports that follow it, and a "no issue found" contradicted by later reports is flagged in public (`#/track`).
  107 tests, CodeQL, and two real relayer bugs found and fixed (IP
  spoofing, a 429 hang).

## Organiser questions (private to judges)

1. **Live app URL** \*: https://tolmol-web-kappa.vercel.app (public, no login; the same build is on GitHub Pages at https://amannx21.github.io/Tolmol/)
2. **Indian nationality** \*: Yes (AMAN ARORA)
3. **Why Arkiv?** \*

   Tolmol exists to make one thing impossible: quietly removing or rewriting a complaint, or faking the other side's
   answer. It falls apart without three Arkiv properties. (1) **Records nobody can edit or delete**: `readonly` plus
   an ownership transfer to `0x…dEaD` in the same atomic batch; on Postgres behind our API, we or anyone who pressures
   us could delete a row and nobody outside could tell, and our own signed API would still let us choose what to serve.
   (2) **Authorship set by the protocol** (`$creator`): every rule that makes the data trustworthy depends on it (one
   report per phone, confirmations from a different phone, answers and boards only from the outlet's verified
   operator, "fixed" only from the reporter, officials only in their district, inspectors only inside their window).
   (3) **Queries with no operator**: anyone can ask "every report at this school in October, by month" over typed
   attributes; IPFS keeps content but needs an indexer someone runs and can switch off, and a subgraph needs a
   contract, an indexer and its operator. We also rely on Entity Expiration (lifetimes the reporter chooses;
   delegation windows), Lifetime Extension (confirmations keep evidence alive), and `atBlock` (what was public at
   block N). If our site and repository disappeared, the data would still be readable with curl.

   Kept off Arkiv on purpose: names, phones, Aadhaar, ration card and job card numbers, children's names, addresses
   (hashes would be reversible), free text, photos, household size as a field, the exact time (rounded to the day),
   exact MGNREGA wages (rounded to ₹500), proofs of authorship (checked in person, never stored), device keys, the
   relayer's rate-limit data and IPs, and aggregates (anyone can recompute them).

4. **How do you use Arkiv?** \* Every feature changes something the user sees. Full list with permalinks to the exact
   lines (44 features): https://github.com/amannx21/Tolmol/blob/submission-v1/docs/ARKIV_USAGE.md

   - **Typed attributes, empty payload:** everything readers filter on is typed (grams, days or rupees as i32, basis
     points, a u64 day); there is no field for free text. *User sees:* filters by district, month and problem.
   - **Compound + range + `OR` queries, `createdBy()`:** the dashboard ranks by state and month range; one `OR` query
     reads every ration shop, school and panchayat, trusted only from the registry. *User sees:* the ranking, the
     outlet pickers; fake outlets never appear.
   - **`$creator` as the trust rule, everywhere:** answers, boards, "fixed", withdrawals, official actions, inspector
     findings count only from the right wallet. *User sees:* "2 answers or follow-ups ignored", with who wrote them.
   - **Readonly + ownership transfer to `0x…dEaD` in one batch (`predictEntityKeys`):** reports, confirmations,
     answers, boards, actions. *User sees:* "Sealed: nobody can edit or delete it, including us".
   - **Entity Expiration per type, chosen by the reporter:** 30, 90 or 180 days; delegations live their window plus a
     year. *User sees:* the expiry choice, days left on every report.
   - **Lifetime Extension as a lease renewed by activity:** the 2nd confirmation extends the report and its witnesses.
     *User sees:* the expiry moving out when neighbours confirm.
   - **Creation flags read back:** `permissionlessExtension` lets the community keep evidence alive unless the reporter
     opted out, and witnesses respect that choice. *User sees:* "let neighbours keep it longer".
   - **Owner kept on purpose:** a delegation stays owned by the official, who can delete it to revoke the inspector.
   - **Cursor pagination pinned with `atBlock`, and `atBlock` history:** *User sees:* "Show as it was at block N".
   - **WebSocket `watchEntityEvents`, no `fromBlock`:** *User sees:* the dashboard updating live.
   - **RPC headers (`Arkiv-Cost`, `RateLimit`):** *User sees:* each query's cost and the reads left in the footer, and a
     labelled saved copy when the budget runs out.

5. **Friction report** \*: https://github.com/amannx21/Tolmol/blob/submission-v1/arkiv/friction.md
6. **Wallet addresses** \* (full list with roles: https://github.com/amannx21/Tolmol/blob/submission-v1/arkiv/wallets.md):
   - `0x6DBf6A36E27d814c58A05312913DCEEfc0dAe221`: registry: creates every synthetic shop, school and panchayat, and names the verifiers
   - `0x1C58335A9C5c5a3440f8018984cf9069b7C9408B`: card verifier: creates the verification attestations
   - `0xFdbFff21C655c698a69205D2eb5Ec73a2F2d2dE6`, `0x40885B892dFbc317F9ffb7b5A410e9E8f00406e0`: demo dealers (answers, stock boards)
   - `0xC29C54165B368C42E1263b675286aBd3DCfDCf0A`, `0xff2343feCC600f8A68DF60376334C68B3eA3a114`: demo head teacher and employment assistant (answers, meal and work boards)
   - `0x20e2B6010a4a9128EAEDea408B29A4AC5a44a410`: demo district official (actions, delegation); `0xDa4c041B4A1ec3825D6Fb389bfda91DBEC1188E6`: delegated inspector
   - `0xAe8DCc161d9F27fACFE6D48A8B4DF148D64ab9E3`, `0xA7EF19b057E28BcB7048a202992423Da937Df140`: witnesses in tests
   - `0xDAD092E626A158220Aa2838d25CCD69F51de76BE`: reporter in tests, funds the demo wallets; 10 synthetic seed devices file reports and confirmations (listed in wallets.md and `docs/seed-manifest.json`)
   - `0x357A30b18BF4020F243186d76dBdD44b830119e2`: relayer, sends test-GLM drips only, never creates Tolmol entities
   - Real visitors' phones create their own wallets in the browser: read `creator` from any query
7. **Schema** \*: https://github.com/amannx21/Tolmol/blob/submission-v1/arkiv/schema.md
8. **How judges can reproduce** \* (app: https://tolmol-web-kappa.vercel.app):
   1. Without our app: run the curl in the README, or open `#/raw` and copy any query as curl, JavaScript or Python.
      Every report has `owner = 0x…dEaD`. `python examples/tolmol_reader.py SYN-BR-0042`, `node
      examples/minimal-reader.mjs SYN-BR-0042` (only the Arkiv SDK) and `/mirror.html` (one file, any RPC) give the
      same numbers as the shop page.
   2. `#/dashboard?state=BR`: shops ranked from `arkiv_query`, the "needs official attention" list, the live badge.
   3. `#/shop/SYN-BR-0042`: the stock board against card holders' reports (unaccounted kg), the board's versions, "2
      answers or follow-ups ignored" (planted fakes), the score card, officials' actions. Type a past block in "Show as
      it was at block" (`atBlock`).
   4. `#/shop/SYN-BR-0001`: a shop that earns the Fair shop badge, recomputed from public data.
   5. The bar under the menu: **School meals** and **MGNREGA wages**. `#/shop/SYN-BR-5001` (meal board vs parents'
      reports, planted fakes ignored) and `#/shop/SYN-BR-7001` (work board, unaccounted wages, an official's actions).
   6. Report something (`#/report`, or `#/report?scheme=mdm`): the "before you send" box, separate ID, send later.
      Gas is fetched automatically. Open the link in another browser profile and confirm it.
   7. `#/test-cards`: "Use on this phone" on a test ration card, then verify: the phone's reports show ✓; the same card
      in another browser profile is refused (one card, one phone). Or use a test dealer licence or a head teacher / employment assistant ID, then **Open my dashboard**:
      answer reports, post the monthly board.
   8. `#/proof`: issue a code; on your own report, the hearing kit signs it; the check confirms the signer is `$creator`.
   9. `#/verify`: "Tamper with a copy and check it": the edited row fails against Arkiv.
   10. `#/trust`: the registry checked against this repository, verifiers and when their approval lapses.
   11. Footer, "Arkiv queries on this page": each query, its `Arkiv-Cost`, the reads left.
   12. The whole story in six steps: `#/tour`.
   13. From a clone: `npm ci && npm test` (107 tests), `npm run tolmol -- answers --shop SYN-BR-0042`,
       `node --import tsx scripts/privacy-audit.ts` (every Tolmol entity against the contract: PASS).
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
16. **Our work, built 9 to 18 Oct, disclosed** \*: Yes
17. **Repo public under MIT, links accessible** \*: Yes ([FILL: re-check in an incognito window before submitting])
18. **Attending Devcon 8**: [FILL: optional]
