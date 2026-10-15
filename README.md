# Tolmol · तोलमोल

**A community-witnessed, tamper-evident ledger of ration (PDS) shortfalls, so beneficiaries have shared,
queryable evidence that no dealer, official or app host can quietly erase.**

Built on [Arkiv](https://arkiv.network), the Web3 database, for the Arkiv Global Tour Stop (9 to 18 Oct 2026).
Tracks: **Best Indian Use Case** (primary), Censorship Resistance, Open Source, Privacy, Security.

| | |
|---|---|
| Live app | **https://tolmol-web-kappa.vercel.app** (Vercel; no login, works on a phone, English + हिन्दी) |
| Backup host | https://amannx21.github.io/Tolmol/ (GitHub Pages; the same build, deployed from `main`) |
| npm package | [`tolmol-sdk`](https://www.npmjs.com/package/tolmol-sdk): `npm install tolmol-sdk` (read the data and apply the rules; read-only CLI `npx tolmol-sdk`) |
| One-file reader | [`mirror.html`](https://tolmol-web-kappa.vercel.app/mirror.html): no framework, no build, any Arkiv RPC; save it and open it anywhere |
| Gas-drip relayer | https://tolmol-relayer.vercel.app/health (Vercel; sends test GLM to fresh device wallets only) |
| Demo video (3 min) | **[FILL]** |
| Network | Arkiv **Tiramisu** testnet, chain ID `7738577` · [explorer](https://tiramisu.explorer.arkiv.network) |
| Data contract | [`arkiv/schema.md`](arkiv/schema.md) · Friction report: [`arkiv/friction.md`](arkiv/friction.md) · Wallets: [`arkiv/wallets.md`](arkiv/wallets.md) |
| Judged commit | **[FILL at deadline: SHA of tag `submission-v1`]** |

> **All data is synthetic.** Every shop ID starts with `SYN-` and every seeded report carries `synthetic = true`.
> Districts are real place names; the shops, dealers and reports are invented. No real person appears in the demo records. Landing-page reference photographs show real PDS settings and carry separate photo credits.

| Live dashboard | Hindi | Shop timeline | A report (owner `0x…dEaD`) |
|---|---|---|---|
| ![Dashboard](docs/media/dashboard-en.jpg) | ![Dashboard in Hindi](docs/media/dashboard-hi.jpg) | ![Shop page](docs/media/shop-page.jpg) | ![Report](docs/media/report.jpg) |

## The problem

India's Public Distribution System gives free grain to **81.35 crore people** through **over 5 lakh fair-price
shops** ([PIB, 29 Nov 2023](https://www.pib.gov.in/PressReleasePage.aspx?PRID=1980686)). Under the National Food
Security Act, a priority household is entitled to **5 kg per person per month** and an Antyodaya family to
**35 kg per family per month** ([nfsa.gov.in](https://nfsa.gov.in/portal/nfsa-act)).

People still get less:

- About **28%** of PDS grain never reaches the intended beneficiaries, by ICRIER's estimate from the
  2022-23 household consumption survey (25.3% without the state-offtake adjustment). The authors note the survey
  caveats ([Das, Roy & Gulati, ICRIER, Nov 2024](https://icrier.org/pdf/pb-27.pdf)).
- The government itself changed the rules in 2021 to fund electronic weighing scales linked to ePoS devices, "to
  ensure right quantity to beneficiaries" ([PIB, 21 Jun 2021](https://www.pib.gov.in/PressReleasePage.aspx?PRID=1729070)).
- When verification fails, people get nothing: in Jharkhand's biometric rollout, **1.5 to 2 million** legitimate
  beneficiaries lost access at some point ([Muralidharan, Niehaus & Sukhtankar, NBER w26744](https://www.nber.org/papers/w26744)).

When a card holder is given 4 kg instead of 5, there is no neutral record. It is their word against the
dealer's, and complaints made on a portal or a WhatsApp group can be deleted, ignored or lost. Full source notes:
[`docs/SOURCES.md`](docs/SOURCES.md).

## What Tolmol does

1. **Report.** A card holder picks their (synthetic) shop, month and grain, and enters what they were entitled
   to and what they received. Their phone signs it with an anonymous device key. No name, phone, Aadhaar or card
   number is asked for or stored, and there is no free-text box. In Full mode the reporter also chooses how long
   the report stays on Arkiv (30, 90 or 180 days) and whether neighbours may extend it.
2. **Corroborate.** Another card holder at the same shop taps "I also got less at this shop this month" on their
   own phone. Two confirmations automatically extend the report's life (unless the reporter chose a fixed one).
3. **Check and export.** Anyone (journalist, NGO, social-audit group, RTI filer) can see the worst shops in a
   district, open a shop's timeline, view it **as it was at any past block**, and download CSV/JSON evidence where
   every row has an entity key, creator address, block number and explorer link.
4. **Act on it.** "Draft my RTI" writes a Right to Information application (English or Hindi) to the District
   Supply Office for the shop's stock and distribution registers, citing Sections 6(1), 6(2), 7(1) and 7(5) of
   the RTI Act 2005, with the on-chain evidence as an annex. Name and address are blanks filled in by hand.
   **"Complaint to the DGRO"** writes a complaint to the District Grievance Redressal Officer under Section 15 of
   the National Food Security Act, with the shop's shortfall and issue counts. Each shop page also has a QR code to
   share, so card holders at the shop can open it and confirm reports.
5. **Say what else went wrong: four short questions, 17 answers.** Grain (thumb taken but grain not given, the
   machine slip shows more than you got, not weighed in front of you, a different grain, a family member's share left
   out, bad grain); money (asked to pay, made to buy dal/salt/oil/soap, no receipt); getting the ration (fingerprint or
   OTP failed, shop closed, 3+ trips, told it "lapsed", other-state card refused); and how you were treated (card kept
   by the dealer, scolded or threatened, no display board). Each is a problem card holders report in practice
   ([`docs/SOURCES.md`](docs/SOURCES.md) §13). Stored only as two small numbers, never as text.
6. **Know what to do next.** After a report: call the free food helpline **1967**, print the DGRO complaint or the
   RTI. If a card from another state was refused, it adds that under One Nation One Ration Card the ration can be
   taken at any ration shop in India.
7. **Fix a mistake without deleting anything.** A reporter can **withdraw** their own report. The withdrawal is a
   new sealed entity; the report stays readable, tagged "withdrawn by its reporter", and drops out of totals. Only
   the device that wrote a report can withdraw it.
8. **Check the evidence.** The **Verify** page takes an exported JSON evidence file and checks every row against Arkiv, so an
   official handed an evidence file can tell whether it was edited.
9. **Verified card holders (demo with test cards).** Anyone can make a device ID, so a phone can be verified with a
   ration card: a verifier checks the card's signature once and publishes "this phone is a verified card holder" on
   Arkiv. Reports and confirmations then show **✓ verified card holder**, shop pages say how many reports are verified,
   and the dashboard can count only verified reports. One card verifies one phone. The demo uses **synthetic test
   cards** ([`#/test-cards`](https://tolmol-web-kappa.vercel.app/#/test-cards)) signed by a test key; in future the card is
   the DigiLocker ration card ([`docs/VERIFIED_REPORTERS.md`](docs/VERIFIED_REPORTERS.md)). Verification is optional, so
   nobody is silenced.
10. **Shops answer, reporters confirm (a community score card).** The shop's dealer, verified with a (test) dealer
   licence, can answer any report about their shop by picking what they did: full quantity will be given, stock
   arrived, scale checked, shop open as displayed, board updated, receipt given, money returned, help when fingerprint
   fails, bad grain replaced, other-state card holders served, or "we dispute this". The choices follow the dealer's
   duties in the TPDS (Control) Order 2015, clause 10. **There is no text box**, so a dealer cannot name or threaten
   anyone, and answers are sealed like reports. Only the report's own phone can then say **"fixed ✓"** or **"not fixed
   ✗"**. Shop pages show a score card (answered, fixed as confirmed by reporters, not fixed, disputed), and the
   dashboard shows it per shop. A shop improves its standing only by fixing things its reporters confirm, never by
   editing or hiding reports.
11. **Officials act on the record.** The dashboard has a public **"Needs official attention"** list, worked out from the
   evidence with fixed rules anyone can check (20%+ short over 3+ reports, money charged for free grain, reporters
   saying "not fixed", reports the shop ignored, confirmations, verified card holders). A verified official of the
   district (test official ID in the demo) can record what the department did, on the shop's page: inspection
   ordered, inspected (shortage found / no issue), show-cause notice, licence suspended or cancelled, case registered
   under the Essential Commodities Act, grain restored. These follow the TPDS (Control) Order 2015, clauses 10(7),
   11(1) and 13. Actions are sealed, so nobody, the department included, can quietly remove them. A shop leaves the
   list only when its numbers improve, so recording an action cannot whitewash a shop, and inaction stays visible.

**One site for everyone.** Card holders, shop dealers, officials and visitors use the same link and the same menu
(Home, Shops, My activity, Verify, Get verified, About, Report). The home page shows what each person can do: a
verified dealer sees "N reports waiting for your answer", a verified official sees the attention list, a card holder
sees the status of their reports. Roles come from verification records on Arkiv, so they cannot be faked. **My
activity** lists this phone's reports with confirmations, the shop's answer and whether it was fixed. **See how it
works** (`#/tour`) walks through the whole story in six steps.

**Two modes, chosen on first visit and switchable anytime.** Easy mode changes how things look, never what you can
do: every page and option is in both.

- **Easy (आसान)** is for card holders who are not used to apps. It asks one question per screen with big buttons:
  shop (remembered after the first time), month, card type, family size, then the amount received set with
  large “1 kilo less” / “1 kilo more” buttons, with optional direct number entry. It reads each question aloud in Hindi with the phone's own voice.
  Test gas is fetched silently, and there are no blockchain words. After saving, a WhatsApp button asks
  neighbours to confirm, and confirming is one big "मुझे भी कम मिला ✓" button.
- **Full (पूरा)** is for helpers, journalists and auditors: dashboard, per-grain form, explorer links, history
  and exports. In Easy mode the same details sit behind "जाँच के लिए पूरा विवरण" (details for auditors).

Both modes write exactly the same Arkiv entities through the same validated SDK calls.

Works on a low-end phone: installable (web manifest), the app shell loads offline, and a report made with no
signal is kept on the phone and signed and sent automatically when the connection returns. The shop QR code is
meant for WhatsApp, NGO posters or panchayat boards, not the dealer's wall, where it would just be torn down.

## Why Arkiv (and what breaks without it)

| If we used… | What breaks for a ration card holder |
|---|---|
| **Postgres behind our API** | We, our host or anyone who pressures us can `DELETE` a complaint or edit a number, and nobody outside can tell. The record is only as trustworthy as the operator. |
| **Our own API with signed records** | Signatures prove authorship, but the operator still decides what to serve. Hiding a shop's complaints is invisible to readers. |
| **IPFS** | Content is immutable, but there is no way to ask "all reports for shop X in October with shortfall over 10%" without building and trusting an indexer. Pinning is a cost someone stops paying. |
| **A subgraph over a contract** | Works, but needs a contract, an indexer and its operator. The query layer is one more thing that can lag or be turned off. |

What Tolmol relies on, and gets only from Arkiv:

- **Queryable and owned by no one.** Reports are typed, indexed attributes that any browser can query with
  `arkiv_query`, with no Tolmol backend in between. If our website disappears, the data does not.
- **Unforgeable authorship.** `$creator` is set by the protocol from the signer. The "different witness" rule and
  per-device dedupe both depend on it.
- **Undeletable without a contract.** `readonly` + an ownership transfer to `0x…dEaD` in the same atomic batch
  means nobody (not even the reporter) can edit or delete a report.
- **Community-kept lifetime.** `permissionlessExtension` lets the people who corroborate a report keep it alive.
- **History.** `atBlock` reads show exactly what was public at any block, for evidence that something was (or was
  not) on record at a given time.

**Kept off Arkiv on purpose:** names, phone numbers, Aadhaar, ration card numbers, addresses (hashing does not
help, they are guessable), free text, photos of receipts or scales, household size, the exact time of a report
(rounded to the day), device private keys, relayer rate-limit data and IPs, and aggregates (anyone can recompute
them). Details in [`arkiv/schema.md`](arkiv/schema.md#what-stays-off-arkiv-on-purpose).

## How we use Arkiv

Every feature below changes something the user sees. Permalinks to exact lines: [`docs/ARKIV_USAGE.md`](docs/ARKIV_USAGE.md).

| Arkiv feature | How Tolmol uses it | Why | Code |
|---|---|---|---|
| Typed attributes vs payload | 16 typed attributes per report (i32 grams, i32 basis points, i32 issue bitmask, u64 day, str IDs); **empty payload** | Everything a reader filters on is indexed; there is nothing else to store, and no field for free text | [`attributes.ts`](packages/tolmol-sdk/src/attributes.ts) |
| Compound queries + ranges | `state = BR AND month_num >= 202608 AND month_num <= 202610 [AND shortfall_bp >= x]` | Dashboard ranking by district and month range | [`queries.ts`](packages/tolmol-sdk/src/queries.ts) |
| `createdBy()` | Shops are trusted only from the registry wallet; dedupe checks use the device as creator | Fake shops never appear in the picker; one report per device per shop-month-grain | [`queries.ts`](packages/tolmol-sdk/src/queries.ts) |
| `$creator` in the UX | Every report and witness shows its device address with an explorer link | Authorship anyone can verify, that no one can forge | [`ReportView.tsx`](apps/web/src/ReportView.tsx) |
| `$creator` as the trust rule | A withdrawal (`tolmol.correction`) counts only if its creator wrote the report | A dealer cannot "withdraw" a card holder's complaint | [`rules.ts`](packages/tolmol-sdk/src/rules.ts) |
| `$creator` + district for official actions | A `tolmol.action` counts only from a device verified as an official whose ID's shop is in the same district (from the registry); sealed in one batch | Strict action is on the record and attributable; nobody can fake it or delete it | [`official.ts`](packages/tolmol-sdk/src/official.ts) |
| `$creator` on both sides of an answer | A shop's answer (`tolmol.response`) counts only from a device verified as THAT shop's dealer; "fixed / not fixed" (`tolmol.followup`) only from the report's own device. Both sealed (readonly + transfer to `0x…dEaD`) | Neither the dealer nor the reporter can fake the other side or take back what they said | [`answers.ts`](packages/tolmol-sdk/src/answers.ts) |
| `createdBy()` chain of trust | Registry names verifiers (`tolmol.verifier`); a device is verified only by an attestation from a named verifier; one device per card | The "✓ verified card holder" badge cannot be forged by writing the same fields | [`verify.ts`](packages/tolmol-sdk/src/verify.ts), [`verifier.ts`](apps/relayer/src/verifier.ts) |
| Cursor pagination + pinned block | Every walk is `.limit(200).atBlock(head)` with `next()` | Consistent pages; dashboards beyond 200 reports | [`queries.ts`](packages/tolmol-sdk/src/queries.ts) |
| `atBlock` historical reads | "Show as it was at block N" on every shop page and in exports | Evidence of what was public at a point in time | [`ShopPage.tsx`](apps/web/src/ShopPage.tsx) |
| Creation flags | Reports and witnesses: `readonly` + `permissionlessExtension` (the reporter can switch extension off); flags are read back with `select({ creationFlags })` | Nobody can edit; the community can keep evidence alive unless the reporter wants it to expire on time | [`writes.ts`](packages/tolmol-sdk/src/writes.ts), [`queries.ts`](packages/tolmol-sdk/src/queries.ts) |
| Ownership transfer | Each report is handed to `0x…dEaD` in its creating batch | Removes the owner's delete right: nobody can delete it | [`writes.ts`](packages/tolmol-sdk/src/writes.ts) |
| Entity Expiration per type | Shops 180 days; reports **30, 90 or 180 days, chosen by the reporter**; witnesses = report deadline; withdrawals = report creation + 365 days | Expiry the user controls; lifetimes follow how long evidence is useful (complaint, RTI) | [`constants.ts`](packages/tolmol-sdk/src/constants.ts), [`ReportForm.tsx`](apps/web/src/ReportForm.tsx) |
| Lifetime Extension | The 2nd confirmation extends the report and its witnesses to +180 days (cap 365) | A lease renewed by community activity | [`writes.ts`](packages/tolmol-sdk/src/writes.ts), [`rules.ts`](packages/tolmol-sdk/src/rules.ts) |
| Atomic batches | Report = create + transfer; witness = create + transfer + N extensions | Either all of it lands or none: no window where a report is deletable | [`writes.ts`](packages/tolmol-sdk/src/writes.ts) |
| `predictEntityKeys` | Predicts the new key so the same batch can transfer it | Needed to reference an entity created in the same batch | [`writes.ts`](packages/tolmol-sdk/src/writes.ts) |
| WebSocket entity events | `watchEntityEvents` on a `webSocket()` transport, no `fromBlock` | The dashboard updates when a report lands, without polling | [`live.ts`](packages/tolmol-sdk/src/live.ts), [`Dashboard.tsx`](apps/web/src/Dashboard.tsx) |

## Reproduce it (judges)

### 1. See the data without our website

```bash
curl -s https://rpc.tiramisu.db-chain.testnet.arkiv.network \
  -H 'content-type: application/json' \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"arkiv_query\",\"params\":[\"project = str('tolmol') AND type = str('tolmol.report') AND shop_id = str('SYN-BR-0042')\",{\"limit\":\"0xc8\",\"select\":{\"key\":true,\"creator\":true,\"owner\":true,\"expiresAt\":true,\"attributes\":true}}]}"
```

Every returned entity has `owner = 0x…dEaD`, a device `creator`, and the attributes in `arkiv/schema.md`.

Or open [`mirror.html`](https://tolmol-web-kappa.vercel.app/mirror.html) (one file, plain `fetch`, works with any
Arkiv RPC; it applies the rules in `arkiv/schema.md`), or run `node examples/minimal-reader.mjs SYN-BR-0042`,
which uses only `@arkiv-network/sdk` and prints raw totals for you to build on.

Or with the read-only CLI from a clone (no keys, no website):

```bash
npm ci && npm run build -w tolmol-sdk
npm run tolmol -- query --shop SYN-BR-0042                    # reports, witnesses, explorer links
npm run tolmol -- query --shop SYN-BR-0042 --format csv      # evidence export
npm run tolmol -- query --shop SYN-BR-0042 --at-block 518000 # what was public at that block
npm run tolmol -- dashboard --state BR                        # worst shops in Bihar (synthetic)
```

### 2. Run it from a clean clone

```bash
git clone https://github.com/amannx21/Tolmol && cd Tolmol
npm ci
npm test                         # 54 unit tests, no network
node --import tsx scripts/privacy-audit.ts   # every Tolmol entity on Tiramisu vs the data contract (read-only)
npm run dev -w tolmol-web        # http://localhost:5173 (reads Tiramisu directly)
```

To write: open the app, tap **Get free test gas** (or fund the shown device address at
[hub.arkiv.network/faucet](https://hub.arkiv.network/faucet)), then **Report a shortfall**. Open the report link in
a second browser profile (a different device key) and tap **I also got less at this shop this month**.

### 3. Live end-to-end test and the synthetic dataset

```bash
cp .env.example .env             # add three funded Tiramisu test keys (see the file)
npm run test:e2e                 # files a report, two witnesses corroborate, checks burn owner + extension + atBlock
npm run seed                     # (needs REGISTRY key) publishes the synthetic shops and demo reports; idempotent
```

The seed writes [`docs/seed-manifest.json`](docs/seed-manifest.json): every shop, report and witness key with its
creator and transaction, so the evidence can be re-checked even after entities expire.

## Wallets that create the entities

| Address | Role |
|---|---|
| `0x6DBf6A36E27d814c58A05312913DCEEfc0dAe221` | Registry: creates every `tolmol.shop` (synthetic) |
| `0xDAD092E626A158220Aa2838d25CCD69F51de76BE` | Reporter in tests; funds the seed devices |
| `0xAe8DCc161d9F27fACFE6D48A8B4DF148D64ab9E3` | Witness A in tests |
| `0xA7EF19b057E28BcB7048a202992423Da937Df140` | Witness B in tests |
| `0x357A30b18BF4020F243186d76dBdD44b830119e2` | Relayer: sends test-GLM drips only, never creates entities |
| `0x1C58335A9C5c5a3440f8018984cf9069b7C9408B` | Card verifier: creates `tolmol.attestation` entities (named by the registry's `tolmol.verifier`) |
| `0x20e2B6010a4a9128EAEDea408B29A4AC5a44a410` | Demo official for Gaya district (verified with a private test official ID); recorded 3 actions on SYN-BR-0042 |
| `0xFdbFff21C655c698a69205D2eb5Ec73a2F2d2dE6` | Demo dealer of SYN-BR-0042 (verified with a private test licence); answers reports |
| `0x75a542B54Ab0E187e41b3644e47Ac546B7D1011f` | TEST card issuer: signs the synthetic test ration cards; never writes to Arkiv |
| 10 seed device wallets | Synthetic beneficiaries; listed in [`arkiv/wallets.md`](arkiv/wallets.md) and `docs/seed-manifest.json` |

Real users' device wallets are created in their browsers. To list every wallet that created a report, run the query
above without the `shop_id` filter and read `creator`.

## Track fit

**Best Indian Use Case (Why India?).** Users: PDS beneficiaries (81.35 crore people), social-audit groups, local
journalists and RTI filers. The problem is specific to India's fair-price shops: under-weighing and failed
authentication leave card holders with nothing but their word. Tolmol works on a low-end Android browser, in Hindi
and English, with a numeric-only form, a 141 KB (gzipped) installable app that opens offline and queues reports
until there is signal, and a "Draft my RTI" letter that turns the evidence into an official information request. Honest limits: it needs a little test gas
(our relayer covers it), and the demo uses synthetic shops.

**Censorship Resistance.** Who is harmed if this data is censored? The card holder whose complaint vanishes,
and the auditor who never sees the pattern. We cannot delete or edit a report, and neither can our host: the
data is on Arkiv, readable with the curl above, the SDK or the CLI, even if the website is down.

The site itself is on two hosts, any Arkiv RPC can be set in Settings, and `mirror.html` is a single file anyone
can keep and open offline.

**Privacy.** Who is exposed if this data leaks? A card holder who complains about the dealer they depend on every
month. So the explorer shows nothing personal: no name, phone, Aadhaar, card number, address, household size or
free text (not even hashed); 16 small attributes; empty payloads; the time rounded to the day. The user controls
expiry: 30, 90 or 180 days, and whether neighbours may extend it. With **a separate anonymous ID for each
report** turned on, every report is signed by a fresh key funded by the relayer (which funds every fresh wallet), so
nobody can link one person's reports, not even through who paid the gas. Letters keep name and card number as paper
blanks. Anyone can run
`scripts/privacy-audit.ts`, which checks every Tolmol entity on Tiramisu against
[`docs/data-contract.schema.json`](docs/data-contract.schema.json). Open: block times are public, and with the
option off, reports under one ID are linkable (threat model T15).

**Security.** Who is misled if this data is forged? Officials and journalists who act on it. Authorship by
`$creator` everywhere: registry-only shops, per-device dedupe, a witness must be a different device, a withdrawal
counts only from the report's own creator, derived numbers recomputed by every reader, a Verify page for exported
evidence, a rate-limited relayer that never signs data, no secrets or personal data on chain. Fake reports from
many phones are hard to stop, so Tolmol makes them visible: each shop page lists **patterns to look at** (3 or more
phones filing within one minute, rapid confirmations, one-off devices), worked out from public block numbers and
`$creator`, and the dashboard can leave burst reports out. On the live data it flags exactly the shops our seed script
filled in bursts. And a phone can be **verified with a ration card** (demo: synthetic test cards): the badge counts only
from verifiers named by the registry, one card per phone, so a fake account cannot claim it. See the threat model below for what is still open.

**Open Source.** MIT. A documented data contract ([`arkiv/schema.md`](arkiv/schema.md), and as JSON Schema in
[`docs/data-contract.schema.json`](docs/data-contract.schema.json)), a reusable [`tolmol-sdk`](packages/tolmol-sdk)
package **published on npm** (`npm install tolmol-sdk`), a read-only CLI, a [minimal reader](examples/minimal-reader.mjs) with no Tolmol code, and contribution
notes. Every shop and dashboard page prints the exact queries it ran ("How this is computed"). Another scheme
(mid-day meals, MGNREGA wages) could reuse the same pattern: synthetic registry, device-signed claims,
corroboration as lease renewal.

## Threat model (summary)

Mitigated: operator deletion or edits, website takedown, a blocked RPC, linking one person's reports (optional
separate IDs), forged authorship, fake shops, forged
derived numbers, duplicate and self-witness inflation, withdrawals by anyone but the reporter, edited evidence
files, relayer abuse, leaked secrets. **Open:** sybil wallets (partly limited by
gas and relayer caps, and made visible by burst patterns), collusion, dishonest reporters, and linkability of one device's reports. Full table:
[`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md).

## Architecture

```mermaid
flowchart LR
  P["Phone: Tolmol web app + device key"] -- "executeBatch: create + transfer to 0x…dEaD" --> A[("Arkiv Tiramisu")]
  P -- "arkiv_query reads, WebSocket events" --> A
  P -- "POST /drip" --> R["Gas-drip relayer (test GLM only)"] -- "GLM transfer" --> A
  C["Anyone: curl / SDK / CLI"] -- "arkiv_query" --> A
```

No Tolmol database, no Tolmol read API. Details: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Future scope: government adoption

Fake accounts are the main open problem: anyone can make a device ID. The plan is a **verified, anonymous card-holder
badge**: one real ration card = one verified member, checked once (from home with the DigiLocker ration card through a
department-run or NGO verifier, or in person at a social-audit camp), after which reports prove "a verified card
holder" without saying who, so even a state verifier cannot tell who complained. It also covers department replies
on the record and signed ePoS weighing receipts. All of it is Arkiv entities trusted by `$creator`, with no Tolmol
database: [`docs/VERIFIED_REPORTERS.md`](docs/VERIFIED_REPORTERS.md) (design, not built).

## Known limitations

- Testnet only. Gas comes from the faucet or our relayer.
- Anonymous Arkiv reads are capped at about 100 queries per IP per ~13 minutes (friction F13). The app reads
  per viewer, so this is per person, but heavy use from one network can hit it.
- Verification uses **synthetic test cards** in this demo, and the public test cards, dealer licences and official
  IDs let anyone verify a phone as a card holder, a demo shop's dealer or a district official (threat model T35). In
  production the card would come from the state (DigiLocker). In this simple version the verifier could link a
  verified phone to its card (threat model T26); the anonymous design removes that.
- Unverified devices are still allowed (on purpose), so there is no proof that every device belongs to a real card holder (see the threat model). Design for an optional,
  anonymous "verified card holder" badge, built on Arkiv entities with no identity data: [`docs/VERIFIED_REPORTERS.md`](docs/VERIFIED_REPORTERS.md) (not built).
- Hindi strings were drafted with an AI assistant and need native review.
- The trust filter ("count only confirmed reports") is a view, not proof: confirmations can also come from sybil devices.
- The relayer keeps per-IP limits in instance memory on Vercel; the on-chain fresh-wallet checks are the hard limit.
- Expired entities leave queries; their transactions and our exports remain.

## Built during the hackathon

All code was written between 13 and 18 Oct 2026. Pre-existing work: **none**. The only earlier commit
(`0902494`) is GitHub's generated `LICENSE` and `.gitignore`. Timeline: [`docs/BASELINE.md`](docs/BASELINE.md).

## Licence

[MIT](LICENSE)
