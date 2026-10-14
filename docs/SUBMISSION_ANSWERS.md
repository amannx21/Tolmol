# Devfolio submission answers (draft)

Copy-paste source for the Devfolio form. `[FILL]` marks anything not yet true or not yet known.
Nothing here is submitted automatically; the builder submits and publishes.

## Public fields

- **Project name:** Tolmol (तोलमोल)
- **Tagline:** Ration-shortfall evidence that no dealer, official or app host can quietly erase. Built on Arkiv.
- **Tracks:** Best Indian Use Case, Censorship Resistance, Open Source, Privacy, Security
- **Technologies:** Arkiv (Tiramisu), @arkiv-network/sdk 0.8.1, viem, TypeScript, Preact, Vite, Vitest, Node.js
- **Platforms:** Web (mobile-first), CLI
- **Media:** `docs/media/dashboard-en.jpg`, `dashboard-hi.jpg`, `shop-page.jpg`, `report.jpg`
- **Links:** repo https://github.com/amannx21/Tolmol · app https://amannx21.github.io/Tolmol/ · mirror
  https://tolmol-web-kappa.vercel.app · video [FILL]

### The problem it solves *

India's Public Distribution System gives free grain to 81.35 crore people through more than 5 lakh fair-price
shops. Priority households are entitled to 5 kg per person a month and Antyodaya families to 35 kg. Yet ICRIER
estimates about 28% of PDS grain never reaches beneficiaries. When a card holder gets 4 kg instead of 5, there is
no neutral record. It is their word against the dealer's, and complaints on a portal or a phone can disappear.

Tolmol lets a card holder record what they were entitled to and what they received, signed by an anonymous key
on their own phone. Others at the same shop confirm it from their own phones. Each record is created read-only
and handed to an address nobody controls in the same transaction, so nobody (not the dealer, an official, us,
or even the reporter) can edit or delete it. Journalists, social-audit groups and RTI filers can rank the worst
shops, see a shop as it was at any past block, and download evidence with an explorer link per row. A "Draft my
RTI" button turns a shop's evidence into a Right to Information application (English or Hindi), and the app
installs on a phone, opens offline and queues reports until there is signal. An Easy mode (one question per
screen, big buttons, Hindi read-aloud, no typing, no blockchain words) serves people who are not used to apps,
and a Full mode serves helpers, journalists and auditors. A report can also flag what else went wrong (asked to
pay, fingerprint failed, shop closed, card from another state refused), and the app then shows what to do next:
call the 1967 food helpline, print a complaint to the District Grievance Redressal Officer (NFSA Section 15) or an
RTI. A reporter who made a mistake can withdraw their own report without deleting it, and the reporter chooses
how long it stays on Arkiv. No names, phone numbers, Aadhaar or card numbers are ever stored, and all demo data is
synthetic.

### Challenges I ran into *

- The public RPC rejects request bodies over 262,144 bytes. The SDK reports this as "Execution error without
  revert data", which cost time until we probed the HTTP 413 directly. It caps batches at about 57 creates.
- The anonymous query budget is 10,000 units per IP, and each `arkiv_query` costs 100. Two concurrent seed runs
  exhausted it and reads looked like hangs (HTTP 429 hidden behind retries). We redesigned the seed to preload
  state-wide reads, and the live dashboard to fetch only entities transferred to `0x…dEaD`.
- On Arkiv the owner can delete even a read-only entity, so a pressured reporter could delete evidence. We
  solved it without contracts: create + transfer to a burn address in one atomic batch, using predicted keys.
- Extension events report the owner, not the wallet that extended, so corroboration is counted from witness
  entities by `$creator` instead.

### Why this pillar? (one paragraph per track, if the form asks)

- **Censorship Resistance.** A card holder's complaint disappears when the portal, the WhatsApp group or the app
  host removes it, and the auditor never sees the pattern. In Tolmol nobody, including us, can edit or delete a
  report: it is created read-only and handed to an address nobody controls, in one transaction. The data is read
  straight from Arkiv by anyone, with curl, the SDK, our CLI or a one-file `mirror.html` that takes any RPC. The site
  runs on two hosts, and Settings accepts any Arkiv endpoint.
- **Open Source.** Social-audit groups and other civic projects can build on the dataset without asking: MIT code, a
  documented data contract (`arkiv/schema.md` plus `docs/data-contract.schema.json`), a reusable `tolmol-sdk` published
  on npm (`npm install tolmol-sdk`), a read-only CLI, and a minimal reader with no Tolmol code. Every page prints the queries it ran.
- **Privacy.** A card holder who complains about the dealer they depend on every month is exposed if the record
  names them. The explorer shows no personal data: no name, phone, Aadhaar, card number, address, household size or
  free text, not even hashed. Reports have 16 small attributes, an empty payload, and the time rounded to the day. The user
  controls expiry (30, 90 or 180 days, and whether neighbours may extend it), and can sign each report with a
  separate anonymous ID funded by the relayer, so nobody can link one person's reports, not even through who paid the
  gas. A public script audits every Tolmol entity on Tiramisu against the contract (PASS).
- **Security.** Officials and journalists are misled if complaints can be forged or quietly withdrawn. Tolmol
  trusts only `$creator`: registry-only shops, one report per device, witnesses from a different device, withdrawals
  only from the report's own device, every derived number recomputed by readers, and a Verify page that checks an
  exported evidence file row by row against the chain. Because one person with many phones is hard to stop, each shop
  page shows public-data patterns (3 or more phones filing within one minute, rapid confirmations, one-off devices) and
  the dashboard can leave burst reports out. On the live data it flags exactly the shops our seed script filled. A phone
  can also be verified with a ration card (synthetic test cards in the demo; DigiLocker in future): the "✓ verified card
  holder" badge counts only from verifiers the registry names, one card per phone, and the dashboard can count only
  verified reports.

## Organiser questions (private to judges)

1. **Live app URL** \*: https://amannx21.github.io/Tolmol/ (public, no login, static on GitHub Pages)
2. **Indian nationality** \*: Yes (AMAN ARORA)
3. **Why Arkiv?** \*

   Tolmol exists to make one thing impossible: quietly removing a complaint. On Postgres behind our API, we or
   anyone who pressures us can delete or edit a row and nobody outside can tell. Our own signed API still lets
   the operator choose what to serve. IPFS keeps content but cannot answer "all reports at shop X in October with
   more than 10% shortfall" without an indexer someone has to run and trust. A subgraph needs a contract, an
   indexer and its operator. Arkiv gives us queryable records with no indexer, protocol-set authorship
   (`$creator`) that our dedupe and different-witness rules depend on, `readonly` plus an atomic transfer to a burn
   address so nobody can edit or delete, `permissionlessExtension` so the community keeps evidence alive, and
   `atBlock` reads for "what was public at block N". If our site goes down, anyone can still read the data with
   curl, the SDK or our CLI.

   Kept off Arkiv on purpose: names, phones, Aadhaar, card numbers, addresses (hashes would be reversible),
   free text, photos, household size, the exact time of a report (rounded to the day), device private keys,
   relayer rate-limit data and IPs, and aggregates.

4. **How do you use Arkiv?** \* See `docs/ARKIV_USAGE.md` (each feature, why, permalink). Summary:
   typed attributes with an empty payload; compound + range queries; `createdBy()` for the trusted registry and
   dedupe; cursor pagination pinned with `atBlock`; `atBlock` evidence view; `readonly` + `permissionlessExtension`;
   ownership transfer to `0x…dEaD`; per-type Entity Expiration; Lifetime Extension renewed by the 2nd confirmation;
   atomic batches with `predictEntityKeys`; `watchEntityEvents` over WebSocket with no `fromBlock`;
   `creationFlags` read back so witnesses respect a reporter who opted out of extension; reporter-chosen
   Entity Expiration (30/90/180 days); withdrawals as `tolmol.correction` entities trusted only from the
   report's own `$creator`.
   Code: https://github.com/amannx21/Tolmol/blob/submission-v1/docs/ARKIV_USAGE.md
5. **Friction report** \*: https://github.com/amannx21/Tolmol/blob/submission-v1/arkiv/friction.md
6. **Wallet addresses** \*:
   - `0x6DBf6A36E27d814c58A05312913DCEEfc0dAe221`: registry, creates all synthetic shops
   - `0xDAD092E626A158220Aa2838d25CCD69F51de76BE`: reporter in tests; funds seed devices
   - `0xAe8DCc161d9F27fACFE6D48A8B4DF148D64ab9E3`, `0xA7EF19b057E28BcB7048a202992423Da937Df140`: witnesses in tests
   - `0x357A30b18BF4020F243186d76dBdD44b830119e2`: relayer, sends test-GLM drips only
   - 10 synthetic seed devices and every entity they created: `arkiv/wallets.md`, `docs/seed-manifest.json`
   - Per-device wallets of real visitors: run the README query and read `creator`
7. **Schema** \*: https://github.com/amannx21/Tolmol/blob/submission-v1/arkiv/schema.md
8. **How judges can reproduce** \*:
   1. Run the curl in the README ("See the data without our website"). Every report has `owner = 0x…dEaD`.
   2. Open the live app https://amannx21.github.io/Tolmol/, go to Dashboard (Bihar). It ranks shops from `arkiv_query`; the badge says Live.
   3. Open shop SYN-BR-0042. Type a past block (e.g. 518000) in "Show as it was at block" to see `atBlock` history.
   4. Tap Report, "Get free test gas", file a report. Open the link in another browser profile, get gas, tap
      "I also got less at this shop this month". Watch the dashboard update in the first window.
   5. From a clone: `npm ci && npm test`, then `npm run tolmol -- query --shop SYN-BR-0042`.
   6. Without our app: open https://amannx21.github.io/Tolmol/mirror.html (one file, plain fetch, any RPC). It
      applies the same rules (dedupe, other-device confirmations, reporter-only withdrawals) and gives the same
      shortfall as the shop page. `node examples/minimal-reader.mjs SYN-BR-0042` shows the same data with only the
      Arkiv SDK and raw totals (on 2026-10-14 it and the app's rules both gave 125.4 kg short of 375 kg, 33.44%).
   7. Privacy: `node --import tsx scripts/privacy-audit.ts` checks every Tolmol entity against the data contract.
   8. Evidence: export a shop's JSON evidence, edit a number, and load it on the Verify page (`#/verify`): that row fails.
   9. Verified card holders: open https://amannx21.github.io/Tolmol/#/test-cards, tap "Use on this phone" on any card,
      then "Verify this phone". The About page then says the phone is verified, and its reports show ✓. The same card
      in another browser profile is refused (one card, one phone).
   10. Shops answer: open https://amannx21.github.io/Tolmol/#/shop/SYN-BR-0042. The score card reads "Answered 4 of 29
      reports · fixed (confirmed by reporters) 3". Open one of those reports to see the shop's answer and the
      reporter's "fixed ✓". To act as a dealer, use a test dealer licence on #/test-cards, then open a report of that
      shop: the answer buttons appear (fixed choices, no text box).
9. **Pre-existing work** \*: None. Baseline commit `0902494` contains only GitHub's generated LICENSE and .gitignore.
10. **Arkiv surfaces used** \*: TypeScript SDK, Direct JSON-RPC, WebSocket events, Docs, Hub, Faucet, Block Explorer.
    (Arkiv skills: read as reference, not installed.) See `docs/SURFACES_USED.md`.
11. **Other surface**: none
12. **First Arkiv entity** \*: 2 hours or less (first entity at 2026-10-13 08:47:24 UTC, 24 min after starting; `docs/BASELINE.md`)
13. **LLMs used** \*: Claude (Anthropic) via Claude Code. See `docs/LLMS_USED.md`.
14. **One thing Arkiv should improve first** \*: Make quota and size errors explicit in the SDK. Today an HTTP 413
    (request over 262,144 bytes) becomes "Execution error without revert data", and an HTTP 429
    `ANON_COST_LIMITED` looks like a hang. Typed errors with the limit and `Retry-After` would have saved hours.
15. **Feedback call** \*: [FILL: builder's choice]
16. **Our work, built 9 to 18 Oct, disclosed** \*: Yes
17. **Repo public under MIT, links accessible** \*: Yes ([FILL: re-check in an incognito window before submitting])
18. **Attending Devcon 8**: [FILL: optional]
