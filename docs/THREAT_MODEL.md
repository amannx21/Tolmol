# Threat model

Tolmol's promise is narrow: **once a ration-shortfall report is published, nobody can quietly change or
remove it, and anyone can check who published it and when.** It does not promise that a report is true.
This page lists who might attack that promise, what stops them, and what is still open.

## Assets

1. The integrity and availability of published reports and witness entries (the evidence).
2. The anonymity of reporters: no name, phone, Aadhaar or card number is ever written.
3. The relayer's test-GLM balance.

## Actors

| Actor | Wants | Power |
|---|---|---|
| Fair-price-shop dealer | Make complaints about their shop disappear or look weak | Local pressure on card holders; can run their own wallets |
| Official or department | Hide a bad district; avoid RTI scrutiny | Can pressure the app operator or a hosting provider |
| App operator (us) or our host | Under pressure: delete or hide data | Controls the website and the relayer, not Arkiv |
| Spammer or rival | Flood fake reports, or fake "all good" reports | Unlimited throwaway wallets |
| Curious public | Learn who reported | Can read every entity and transaction |

## Threats and controls

| # | Threat | Control | Status |
|---|---|---|---|
| T1 | Operator or host deletes or edits a report | Reports live on Arkiv, not on our server. They are created `readonly` and transferred to `0x…dEaD` in the same atomic batch, so no key can patch or delete them. Tested on chain: owner patch rejected (ReadOnlyEntity), reporter delete after burn rejected (NotOwner) | **Mitigated** |
| T2 | Website taken down or blocked | Data stays queryable from any Arkiv RPC, the SDK, the CLI or the raw query in the README. The static site can be re-hosted by anyone from the MIT repo | **Mitigated** |
| T3 | Reporter pressured to delete their own report | After the burn transfer the reporter has no delete right either. A reporter who made a mistake can only **withdraw** it: a sealed `tolmol.correction` that readers honour, while the report stays readable with a "withdrawn by its reporter" tag. So pressure can at most produce a visible, dated withdrawal, never a silent deletion | **Mitigated** (by design) |
| T4 | Forged report attributed to someone else | Authorship is `$creator`, set by the protocol from the transaction signature. Nobody can create an entity whose creator is another wallet | **Mitigated** |
| T5 | Fake shops injected into the picker | The app trusts shops only from the registry wallet (`createdBy(REGISTRY)`) | **Mitigated** |
| T6 | Forged derived numbers (e.g. inflated `shortfall_bp`) | Every reader recomputes `shortfall_g`, `shortfall_bp` and `month_num` from the raw grams and drops entities that disagree | **Mitigated** |
| T7 | Duplicate reports from one device to inflate a shop's numbers | The app refuses a second report for the same (device, shop, month, grain). Readers keep only the earliest per (creator, shop, month, grain), so writers who bypass the app gain nothing | **Mitigated** for one device |
| T8 | Reporter "confirms" their own report | Witnesses with the same `$creator` as the report are ignored by every reader, and the SDK refuses to write them | **Mitigated** |
| T9 | **Sybil**: one person creates many device wallets to file many reports or confirmations | Each device needs gas. The relayer drips only to fresh wallets, at most 3 per IP per day and 500 per day overall. Every shop page shows **public-data patterns** and the dashboard can leave them out: 3 or more different devices filing within one minute (30 blocks), rapid confirmations, and devices that did nothing else (`patternSignals` in `rules.ts`). Tested on the live data: it flags exactly the shops our seed script filled in bursts. Phones can be **verified with a ration card** (one card, one phone; badge trusted only from registry-named verifiers), and the dashboard can count only verified reports. **A patient attacker with the faucet, many IPs or their own GLM, who spaces out the writes, can still create many wallets** | **Partly mitigated. Open** |
| T10 | **Collusion**: a dealer's friends file "full ration received" reports to dilute complaints | Dashboards show report counts, confirmations and per-report numbers, not just one average. Nothing proves a person is a real card holder at that shop | **Open** |
| T11 | Dishonest reporter (false shortfall) | Confirmations from other devices raise weight. The UI calls reports "claims", not findings | **Open** (inherent) |
| T12 | Griefing: spam entities with our attributes | Readers validate types, ranges and derived fields. The trusted registry filter stops fake shops. Spam that passes validation is visible and attributable to its creator | **Partly mitigated** |
| T13 | Relayer drained or abused | Fresh-wallet check (nonce 0, balance below 0.002 GLM), per-IP and daily caps, a reserve, one send at a time. The per-IP cap reads only the IP header the hosting platform sets (`x-real-ip` on Vercel, `cf-connecting-ip` on Cloudflare): a review on 2026-10-15 found that a visitor-sent `cf-connecting-ip` let anyone pick their own rate-limit bucket on Vercel, which is now fixed and covered by a test. The relayer key holds only test GLM and never signs Tolmol data | **Mitigated** for testnet |
| T14 | Relayer used to censor (refuses some users) | Users can always fund a device from the public faucet. The relayer only helps with gas | **Mitigated** |
| T15 | De-anonymising reporters | No personal fields exist, there is no household-size field (but the entitlement can hint at it, see T36), and `reported_at` is rounded to the day. A reporter can pick a 30-day lifetime, start a **new identity**, or turn on **a separate anonymous ID for each report**: every report is then signed by a fresh key whose gas comes from the relayer (which funds every fresh wallet), so neither `$creator` nor the funding transaction links one person's reports. Tested on Tiramisu: two reports from one phone came from two unrelated wallets. **But** block times are public, reports under one ID are linkable when that option is off, and at one small shop timing may still narrow down who reported | **Partly mitigated. Open** |
| T16 | Device key loss (cleared browser) | The device simply gets a new identity. Old reports stay valid. There is nothing to recover, by design | Accepted |
| T17 | Data expires before it is used | Reports live 30, 90 (default) or 180 days, as the reporter chooses, and are extended to 180 days from now (capped at 365 from creation) once 2 devices confirm. Anyone can extend further (permissionless extension) unless the reporter opted out for privacy, in which case the expiry is theirs to keep. Exports keep keys and transactions after expiry | **Mitigated** |
| T18 | Secrets leaked into the repo or Arkiv | Keys only in `.env` / browser storage. Pre-commit hook compares staged files to the real keys. CI runs gitleaks. No key material is ever an attribute or payload | **Mitigated** |
| T19 | Offline queue tampered with on a shared phone | The queue holds only shop, month, grain and grams, and is signed by that phone's key when sent. Someone with the phone could also just file a report; nothing personal is exposed | Accepted |
| T20 | RTI or complaint letter leaks the applicant's identity | Name, address and card number are blanks filled in on paper; the letters include shop evidence but no device address | **Mitigated** |
| T21 | Someone "withdraws" another person's report (e.g. a dealer's wallet) | A `tolmol.correction` counts only when its `$creator` equals the report's `$creator` (`withdrawnKeys`). Others' corrections are ignored by the app, the CLI and the one-file reader alike | **Mitigated** |
| T22 | The public RPC endpoint is blocked or filters Tolmol queries | Settings (Full mode) takes any Arkiv HTTP/WebSocket endpoint. `mirror.html` is a one-file, zero-dependency reader that takes any endpoint and can be saved and opened offline. The web app is served from two hosts (GitHub Pages and a Vercel mirror). The curl in the README needs only an RPC URL | **Mitigated** for reads |
| T23 | Edited evidence: someone alters an exported evidence file before handing it to an official | The **Verify** page takes an exported JSON evidence file and checks every row against Arkiv by entity key: the creator must match, and so must shop, month and grams for a report, or the report key for a witness. Missing and mismatched rows are shown one by one | **Mitigated** |
| T24 | Spam corrections or issue tags to skew a shop's picture | Corrections from anyone but the report's creator are ignored. Issue tags are part of a report, so they inherit its dedupe and creator rules; an unknown bit makes the whole report invalid | **Mitigated** |
| T25 | The separate-ID option weakens "one report per device" | With per-report IDs the chain cannot tell that two reports came from one phone. The app still refuses a second report for the same shop, month and grain on that phone (it keeps its own list of per-report keys), but someone bypassing the app could already do this with fresh wallets (T9). The relayer's per-IP daily cap limits how many fresh IDs one network can fund | **Accepted** (privacy trade-off) |
| T26 | The verifier links a phone to a card (simple version) | The verifier sees which device a card verified, so it could tie that device's reports to the card holder. Only a keyed fingerprint of a random serial goes on Arkiv, so the public cannot. Test cards carry no name or card number. The anonymous (Semaphore) design in `VERIFIED_REPORTERS.md` removes this; until then, reporters who want unlinkable reports use separate IDs, which do not carry the badge | **Accepted** (demo) |
| T27 | Forged "verified" badge | Anyone can write a `tolmol.attestation` entity, but readers count it only if its `$creator` is a verifier named by a live `tolmol.verifier` from the registry wallet; one device per card (earliest), one card per device. The verifier refuses a card already used by another phone, checking Arkiv itself | **Mitigated** |
| T28 | A dealer uses replies to intimidate ("I know who you are") | Answers are a fixed list of actions; there is no text field, so no name, phone or threat can be written. The dealer sees only device addresses, like everyone else | **Mitigated** |
| T29 | Someone poses as a shop's dealer, or a dealer answers for another shop | An answer counts only from a device with a `role = dealer` attestation for that `shop_id`, from a registry-named verifier (dealer licence). Others' answers are ignored by every reader | **Mitigated** |
| T30 | A dealer claims everything is fixed to improve the score | "Fixed" counts only from the report's own device (`tolmol.followup`, `$creator` = reporter). Dealer claims are shown as claims; "disputed" is visible too | **Mitigated** |
| T31 | A dealer pressures customers to tap "fixed" | The dealer does not know which device is whose, so cannot target the reporter, but could pressure everyone who comes in. The latest follow-up wins, so a reporter can change their answer later, and later months' reports still show any shortfall | **Partly mitigated. Open** |
| T32 | A fake "official action" defames a shop, or an official acts outside their district | An action counts only from a device with an `official` attestation (registry-named verifier) whose ID's shop is in the same district as the shop. Actions are a fixed list, so no accusations in free text | **Mitigated** |
| T33 | Officials ignore the evidence | The "Needs official attention" list is public and computed by every reader from the evidence, so inaction is visible to card holders, journalists and the State Food Commission | **Mitigated** (visibility) |
| T34 | An official whitewashes a shop ("inspected: no issue") | The action is recorded and attributable, but a shop leaves the attention list only when its numbers improve. Later reports keep counting | **Mitigated** |
| T35 | Anyone acts as a dealer or official in the demo | The demo's test dealer licences and official IDs are public (`#/test-cards`), so anyone can verify a phone as a demo dealer or official and answer or record actions on demo shops. Everything is labelled synthetic. In production the licence and ID come from the department (DigiLocker / issued in person), and the issuer key is never public | **Accepted** (demo only) |
| T36 | The public entitlement reveals the household | `entitled_g` is public and the PDS rule is public, so 25 kg suggests a 5-person priority household and 35 kg an Antyodaya card. Earlier docs wrongly said household size and card type stay off Arkiv; corrected 2026-10-15. Kept exact because rounding to 5 kg would move the shortfall by up to 25 points. Every report screen now shows "what becomes public" before sending, including this note | **Accepted, disclosed** |
| T37 | A reporter who was threatened, or whose card the dealer kept, is linked to their other reports | Choosing `threatened` or `card_kept` switches on a separate anonymous ID for that report by default (a fresh relayer-funded key), shown in the preview; the person can switch it off | **Mitigated** |
| T38 | A stranger writes a fake dealer answer or a fake "fixed" to clean up a shop's score | Counted only from the shop's verified dealer and the report's own creator (`$creator`). The shop page lists the ignored writers so the filter is visible; a planted fake answer and a fake "fixed" at `SYN-BR-0042` (`scripts/seed-spoof.ts`) show it working | **Mitigated** |
| T39 | Arkiv's free read budget runs out and the site goes blank (a cheap way to silence it) | The browser keeps the last good answer of each query on the phone and shows it, marked "saved copy", when Arkiv answers 429 or the network fails. Identical queries in flight are merged | **Mitigated** |
| T40 | A dealer posts a false stock board (less than arrived, to hide what was diverted) | The board is the dealer's own sealed statement, attributable by `$creator`; card holders' reports are read against it, so an under-declared board makes the gap look smaller, not the shortfall. Re-posting shows every version. An official can compare it with the allocation order (RTI). Not a proof of what arrived | **Partly mitigated** (it is evidence against the dealer either way) |
| T41 | A dealer games the Fair shop badge with friendly "full ration" reports | The badge needs reports from 2+ devices, and the dashboard can count verified card holders only; bursts of reports are flagged (T25). A badge is recomputed on every read and lapses with the evidence. Real-world use would count verified card holders only | **Partly mitigated** |
| T42 | A proof of authorship is replayed or shown to the wrong person | The proof binds the official's one-time code and a time; it expires after 15 minutes. It reveals only "this phone wrote this report", never a name. A reporter shows it only to an official of their choosing | **Mitigated** |
| T43 | A malicious link switches the app to an attacker's registry (fake shops, fake verifiers) | The choice is shown on every page in a warning banner with a one-tap reset; `#/trust` compares the registry with the address published in the GitHub repository | **Mitigated** |
| T44 | "Send at a random time": the phone is closed and the report never goes out | It waits on the phone and goes out the first time Tolmol is open after its time; the screen says so. It is a choice, on by default only for risky reports and small shops | **Accepted** |
| T45 | Another scheme's report is counted at the wrong outlet, or read as grams by an old reader | An outlet counts only its own scheme's reports; non-ration reports carry `scheme` and items that old readers do not know, so they drop them instead of misreading rupees as grams | **Mitigated** |
| T46 | A delegated inspector oversteps (closes a case, cancels a licence, acts elsewhere or later) | Inspector actions count only as inspection findings, for the one outlet, inside the window, under a delegation from an official of that district. Anything else from that phone is ignored | **Mitigated** |
| T47 | A MGNREGA reporter is identified by matching the reported wage to the public muster roll (names, days worked) | Wages are rounded to the nearest ₹500 by default before they are written (`coarsenWages`), so the exact days worked cannot be read from the record; the shortfall stays within half a step of the truth. The person can choose exact amounts, and the screen explains why rounding is on. Separate ID is automatic for job-card, bribe and fake-name reports | **Mitigated** |
| T48 | A parent is identified at a small school | No child's name or class is asked; the small-outlet warning, separate ID (automatic for "asked to pay" and "seated apart") and send-at-a-random-time apply exactly as for ration | **Partly mitigated** (a very small school stays small) |

## What Tolmol does not solve

- **Truth.** Tolmol records claims and corroborations. It cannot weigh grain.
- **Identity.** There is no proof that a device belongs to a real card holder at that shop. The design for an
  optional, anonymous "verified card holder" badge (checked in person at a social-audit camp, proved with Semaphore,
  stored only on Arkiv, with no identity data) is in [`VERIFIED_REPORTERS.md`](VERIFIED_REPORTERS.md). Not built yet.
- **Gas.** Real users need test (or real) GLM. On testnet our relayer covers this; a production deployment
  would need a sponsored-gas design that does not make the sponsor the creator of reports.
- **Retention after expiry.** Expired entities leave queries. Their transactions remain on the explorer, and
  exports keep the evidence, but Arkiv does not promise permanent query availability.

## Checks anyone can run

- `node --import tsx scripts/privacy-audit.ts`: every `project = "tolmol"` entity on Tiramisu matches the data
  contract (no unknown attributes, no free text, empty payloads). Read-only, no keys.
- The Verify page (`#/verify`): re-checks an exported JSON evidence file against the chain.
- `examples/minimal-reader.mjs` and `public/mirror.html`: recompute shop shortfalls with nothing but the Arkiv SDK
  (or plain `fetch`) and the rules in `arkiv/schema.md`, so the app's numbers can be checked independently.

## Synthetic data

Every shop in this deployment is synthetic (`SYN-` IDs) and every seeded report is flagged `synthetic = true`.
No real shop, dealer or beneficiary appears anywhere.
