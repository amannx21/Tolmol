# Devfolio submission answers

Copy-paste source for the Devfolio form, in the order the form asks. Each field is under its own heading.
Nothing here is submitted automatically; the builder submits and publishes.

> Before clicking submit: create the `submission-v1` tag (the links in questions 4 to 7 need it).
> Deadline: 18 October 2026, 23:59 London time.

---

## Part 1. Project page (public)

### Project name

Tolmol (तोलमोल)

### Tagline

Short ration, meals or wages? Report it on Arkiv.

### Links (repo, app, video)

https://github.com/amannx21/Tolmol
https://tolmol-web-kappa.vercel.app
https://youtu.be/e98TA-ygH4M

### Tracks (tick all 5)

Best Indian Use Case, Censorship Resistance, Open Source, Privacy, Security

### Media

Images of the app and how it works: `docs/media/` (hero, Hindi voice, architecture, chain of trust, the three schemes)

### The problem it solves (also "Why India?")

**The problem.** 81.35 crore Indians are owed free grain every month at more than 5 lakh ration shops, yet about 28% of PDS grain never reaches them (ICRIER, 2024). Mid-day meals for school children and MGNREGA wages go missing the same way. The only record (machine slip, meal register, muster roll) is kept by the side people would complain about, so a complaint is one person's word against a dealer they must face again next month, on a portal that can lose it or in a WhatsApp group whose admin can delete it.

**What Tolmol does:**
1. **Report by tapping and listening.** The phone reads every question aloud in Hindi, and answers are big buttons and + / − steps. No typing, no name, no card number, no sign-up, no app to install. No signal? The report waits on the phone and goes out later.
2. **Neighbours confirm.** Others at the same shop tap "I got less too", or "I got my full ration". A lone claim that 3 others contradict is labelled, never hidden.
3. **The dealer must answer, in public.** Answers come from a fixed list, and a monthly stock board is set against the reports, e.g. at one shop on 18 October: *"14 card holders say they got 37.3% less; about 745 kg is unaccounted for."*
4. **Officials act, and are checked too.** A "needs attention" list, actions on the record, and an inspector's "no issue found" flagged when the next reports say otherwise.
5. **It reaches the right desk.** One tap prints the complaint for the right officer under the right law: the District Grievance Officer (NFSA s.15), an RTI, the State Food Commission.

**Safe to speak up.** Nothing that names the person is stored. Risky reports (a threat, a kept card, a bribe) get a fresh anonymous ID by themselves, and what cannot be said in public goes in a private note only the district official can read.

**Works today** in Hindi and English, in the phone's browser, on synthetic shops, schools and panchayats in real districts of Bihar, Uttar Pradesh and Jharkhand. 4 people outside the team have already filed reports from their own phones, sealed on Arkiv: [1](https://tiramisu.explorer.arkiv.network/entity/0xeb120ffac3d68a43202fe188c855c6cee13bb7cd950aba0c0047cd39158c1d45) [2](https://tiramisu.explorer.arkiv.network/entity/0x509b0046f489a8f51dafbaedc8ce90898b351e43ee9bf6e50a35b3738c883844) [3](https://tiramisu.explorer.arkiv.network/entity/0x4d2083fb525deb9a423fbeb77583cde9aa8a607270d9aa45c75257e4452a3d94) [4](https://tiramisu.explorer.arkiv.network/entity/0xf978ed2dfda6ecb26b6fd7e036592aef0c4a4679d0f54e7706ce8d5aff605682). A state turns it on for real by using its own registry.

### Challenges I ran into

- **Reads ran out without warning.** Arkiv gives an anonymous visitor about 100 queries an hour, but nothing says how many are left until it stops, and our library then waited silently for up to an hour. We made a shop page read everything about the shop in one query (a third of the reads), show the reads left on every page, and say so in plain words when the limit is hit.
- **"Read-only" was not enough.** On Arkiv the owner can still delete a read-only record, so a pressured reporter could be made to delete their own. We hand every record to an address nobody owns in the same transaction that creates it: nobody can delete it, with no smart contract.
- **Privacy against evidence.** The numbers must be public so anyone can recount a shop; the person must stay hidden. So the amounts are public, nothing that names anyone is stored, and only the note to the official is encrypted, to a key that proves it belongs to that official.
- **Real phones are messy.** Old iPhones, laptops without a Hindi voice, the Brave browser, weak signal: we tested each one, fixed what we could, and made the app explain the rest instead of failing silently.
- **A misleading error.** Large batches failed with "Execution error without revert data"; the real cause was a 262 KB request limit, so we cap a batch at 40 records.

---

## Part 2. Why this pillar (one answer per track)

### Why this pillar: Censorship Resistance

**Who is silenced today:** the card holder, parent or worker whose complaint about someone they depend on every month is lost on a portal, deleted by a WhatsApp admin, or quietly dropped by whoever runs the app, so nobody ever sees the pattern at a shop or across a district.

**A bad day for one complaint, and what happens on Tolmol:**
1. **The dealer pressures the reporter to take it back.** Nobody can delete it, not even the reporter: it was sealed as it was written (read-only, handed to `0x…dEaD` in the same transaction). Only the reporter's own withdrawal can mark it, and that is public too.
2. **Someone asks us to remove it.** We cannot. Nobody holds a key that could delete it, including us.
3. **Our website is blocked or taken down.** The same app runs on a second host (GitHub Pages); the one-file `mirror.html` reads every record from any Arkiv server; the README's `curl` and a 25-line script read them with no Tolmol server at all.
4. **Our relayer (free gas) is blocked.** Filing still works: `tolmol submit` signs on the reporter's or a helper's computer, with gas from Arkiv's public faucet. A report filed that way: https://tiramisu.explorer.arkiv.network/entity/0x046b33122784cbf97bd5ea221d780bd1d01a9ec7c6f4a2c55ac7d0a0040c047c
5. **Someone tries to change whose "verified" counts.** Every trust decision starts from one registry address, checked against our repository; every page warns while a different one is in use, and a state or NGO can point the app at its own.

Anyone can read and query everything without our backend, because there is none: `#/raw` lists every query the app makes as curl, JavaScript or Python. **Honest limits:** Tiramisu is a testnet, and someone who cannot use a terminal still needs our relayer or the faucet for gas.

### Why this pillar: Open Source

**Who is locked out today:** a civic group, a journalist or another state that wants ration-shop data has to ask each portal for permission and write a new integration every time.

**What anyone can do with Tolmol, without asking us:**
- **Read the rules:** `arkiv/schema.md`, and all 16 record types as JSON Schema.
- **Install it:** `npm install tolmol-sdk` (0.2.0) gives the same reader and trust rules the app uses; `npx tolmol` reads, files and confirms from a terminal.
- **Build on it in 25 lines:** `examples/build-on-tolmol.mjs` prints every outlet's verdict and every inspector's track record for a state, with no key, no Tolmol server and no clone.
- **Use another language:** a Python reader written only from the contract, with the standard library alone.
- **Count on it staying stable:** a changelog where every change is additive, and a daily public check that what is on chain still matches the contract.

**Proof it is reusable:** mid-day meals and MGNREGA wages were added on the same model without changing a single ration record or breaking the published reader. MIT licence.

### Why this pillar: Privacy

**Who is exposed today:** the person who complains about someone they depend on every month (the dealer, the head teacher, the panchayat) and can be scolded, refused work or have their card kept.

**What Tolmol does:**
- **Nothing that names you is stored**, not even hashed: no name, phone, Aadhaar, card or job card number, or child's name. `#/public` shows a real report exactly as a stranger sees it.
- **Only numbers about the shop are public.** A ration report is 16 small fields (shop, month, amounts owed and received, what went wrong, the day but not the time), with no free text. MGNREGA wages are rounded to ₹500, so a public muster roll cannot point to one worker.
- **Risky reports cannot be linked to you.** A threat, a kept card, a bribe: a fresh anonymous ID is used by itself. Confirmations use a different ID for every shop.
- **Say what you cannot say in public.** A note to the district official is locked on the phone with standard, tested encryption, so only that official's phone can open it; everyone else sees scrambled bytes. The box refuses phone, Aadhaar and card numbers, because even locked text stays in the chain's history.
- **You stay in control:** choose how long a report lives (30, 90 or 180 days); "Remove Tolmol from this phone" deletes every key and setting in one tap if someone may check the phone; optionally send a report later, at a random time.

**Why the amounts stay public, on purpose:** Tolmol protects the person, not the facts. Hiding the shortfall would hide it from the neighbours and officials who must act on it. **Honest limits:** ordinary reports use the phone's usual ID, so "one report per phone" can still be checked; the amount owed can hint at family size; the time a record appears on chain is public. A public audit checks every Tolmol record every day (PASS).

### Why this pillar: Security

**Who is misled today:** officials, journalists and card holders who act on records that can be forged ("all fixed", "full ration given"), quietly withdrawn, or signed off by an inspector who was paid.

**Tolmol's one rule: who wrote it, not what it says.** Arkiv itself records who wrote every entry (`$creator`), and nobody can fake it. So:
- shops count only from the registry; answers and stock boards only from that shop's verified dealer;
- "fixed" and withdrawals only from the person who reported;
- official actions only from that district's official; an inspector's findings only for the one shop and the days they were sent;
- private notes only to a key that proves it belongs to the official.

**See it work:** at SYN-BR-0042 a stranger's wallet planted a fake dealer answer and a fake "fixed". The page shows both as ignored, with who wrote them.
**Who checks the checkers:** every finding is set against the reports that follow it. The demo inspector's "no issue found" at SYN-BR-0002, followed by reports 31% short, is flagged on the public track record under that inspector and the official who sent them.
**Where we stop, honestly:** one person with many phones is the open problem every entry shares; Tolmol shows it (burst patterns on every shop, a verified-only view, one card verifies one phone) instead of hiding it. The demo's test cards are public so judges can try every role; a state would issue real ones.
**Checked by:** 121 tests, CodeQL, every number recomputed by every reader, and an edited evidence file fails the Verify page.

---

## Part 3. Organiser questions (private to judges)

### Question 1. Live app URL

https://tolmol-web-kappa.vercel.app (public, no login; the same build is also at https://amannx21.github.io/Tolmol/)

### Question 2. Indian nationality

Yes

### Question 3. Why Arkiv?

**In one line:** Tolmol needs records that nobody can delete, whose author nobody can fake, and that anyone can search without asking us. Arkiv gives all three at once.

**What would break anywhere else:**
- **Postgres behind our API:** we, our host or anyone who pressures us could delete a complaint, and nobody outside could tell.
- **IPFS:** nobody can change a file, but someone has to keep it pinned and run an index before anyone can ask "every report at this school in October".
- **A subgraph:** a contract, an indexer and its operator, each one a new point to pressure.
- **Our own signed API:** it proves who wrote a record, but we would still choose what to show.

**What Arkiv gives us:**
1. **The author is set by the network** (`$creator`). Every trust rule hangs on it, down to an official's encryption key, which proves itself by hashing to its `$creator`.
2. **Records nobody can delete, with no contract:** read-only, and handed to an address nobody owns in the same transaction.
3. **Questions with no operator:** anyone can ask "everything about this shop" in one query, over typed numbers.
4. **Time built in:** a report lives as long as its reporter chose; an inspector's authority ends by itself; neighbours who confirm a report keep it alive longer; anyone can see the record "as it was at block N".

**What we built on it:** a chain of trust that nobody can step outside, officials included. A registry names verifiers; verifiers vouch for card holders, dealers, head teachers and officials; officials send inspectors for a few days; and each of them is checked by records written later by the people they serve. **Even we are replaceable:** a state can use its own registry, anyone can read everything with curl, and anyone can file a report with the CLI, without our website or relayer.

**Kept off Arkiv on purpose:** names, phones, Aadhaar, ration and job card numbers, children's names, addresses, free text, photos, household size, the exact time and exact wages, the words of a private note (only ciphertext), proofs of authorship, and every private key.

### Question 4. How do you use Arkiv?

By how and why, not how many: **five features Tolmol could not exist without**, each with the reason and what the user sees.

1. **`$creator` as the only trust rule.** *Why:* anyone can write any field, but nobody can fake who wrote an entry. *User sees:* "2 answers or follow-ups ignored", with who wrote them; "Private notes for you" only on the real official's phone.
2. **Read-only + handed to `0x…dEaD` in one atomic batch** (`predictEntityKeys`). *Why:* on Arkiv an owner can delete even a read-only entity, so a pressured reporter could be made to. *User sees:* "Sealed: nobody can edit or delete it, including us".
3. **Typed attributes with compound, range and `OR` queries, read by anyone.** *Why:* grams, days and rupees are numbers, so a dashboard can rank by them; one `OR` query reads every shop, school and panchayat; one query reads everything about a shop. *User sees:* rankings by district and month, and `#/raw` with every query as curl.
4. **Entity Expiration as product logic.** *Why:* evidence should not outlive its purpose, and authority should end by itself. *User sees:* the reporter picks 30, 90 or 180 days and sees days left on every report; an inspector's window ends on its own.
5. **Lifetime Extension renewed by neighbours.** *Why:* a confirmed report deserves to stay longer, decided by the people who confirm it, unless the reporter opted out. *User sees:* the expiry moving out when neighbours confirm.

Also used with the same care: `atBlock` ("show as it was at block N"), live WebSocket events (the dashboard updates by itself), block numbers as evidence (a finding judged by the reports after it), an owner kept on purpose so an official can revoke an inspector, `createdBy()` to stop repeats, and the read-limit headers shown to the user. Every feature, with a permalink to the exact lines (49 in all): https://github.com/amannx21/Tolmol/blob/submission-v1/docs/ARKIV_USAGE.md

### Question 5. Friction report (link)

https://github.com/amannx21/Tolmol/blob/submission-v1/arkiv/friction.md

### Question 6. Wallet addresses

Full list with roles: https://github.com/amannx21/Tolmol/blob/submission-v1/arkiv/wallets.md
- `0x6DBf6A36E27d814c58A05312913DCEEfc0dAe221`: registry: creates every synthetic shop, school and panchayat, and names the verifiers
- `0x1C58335A9C5c5a3440f8018984cf9069b7C9408B`: card verifier: creates the verification attestations
- `0xFdbFff21C655c698a69205D2eb5Ec73a2F2d2dE6`, `0x40885B892dFbc317F9ffb7b5A410e9E8f00406e0`: demo dealers (answers, stock boards)
- `0xC29C54165B368C42E1263b675286aBd3DCfDCf0A`, `0xff2343feCC600f8A68DF60376334C68B3eA3a114`: demo head teacher and employment assistant (answers, meal and work boards)
- `0x20e2B6010a4a9128EAEDea408B29A4AC5a44a410`: demo Gaya official (actions, delegation, key for private notes); `0xDa4c041B4A1ec3825D6Fb389bfda91DBEC1188E6`: delegated inspector
- `0xAe8DCc161d9F27fACFE6D48A8B4DF148D64ab9E3`, `0xA7EF19b057E28BcB7048a202992423Da937Df140`: witnesses in tests
- `0xDAD092E626A158220Aa2838d25CCD69F51de76BE`: reporter in tests, funds the demo wallets
- `0x357A30b18BF4020F243186d76dBdD44b830119e2`: relayer: sends free test gas only, never creates Tolmol records
- Real visitors' phones create their own wallets in the browser: read `creator` from any query

### Question 7. Schema (link)

https://github.com/amannx21/Tolmol/blob/submission-v1/arkiv/schema.md

### Question 8. How can judges reproduce?

App: https://tolmol-web-kappa.vercel.app. Note: Arkiv lets each network make about 100 free reads an hour; the footer of every page shows how many are left. These seven steps fit well inside it.

1. **Read the data without our app:** run the `curl` in the README, or open https://tolmol-web-kappa.vercel.app/#/raw and copy any query the app makes. Every report's owner is `0x…dEaD`: nobody can delete it.
2. **Report in Hindi:** https://tolmol-web-kappa.vercel.app/#/report. Each question is read aloud; answer with big buttons and + / −; before sending you see exactly what becomes public.
3. **A ration shop's record:** https://tolmol-web-kappa.vercel.app/#/shop/SYN-BR-0042. The dealer's stock board against the reports (on 18 October, "about 745 kg is unaccounted for"), "2 answers or follow-ups ignored" (fakes written by strangers' wallets), officials' actions, and "Show as it was at block N".
4. **Who checks the checkers:** https://tolmol-web-kappa.vercel.app/#/track?state=BR. The demo inspector's "no issue found" at SYN-BR-0002 is flagged "contradicted by later reports".
5. **A complaint others contradict:** https://tolmol-web-kappa.vercel.app/#/r/0xc4e04f15b6d787d8c1e434afd9312d47c2b70993db0c18703e93eabcc7ac7fe3 shows "Contradicted by 3 others".
6. **What a stranger sees:** https://tolmol-web-kappa.vercel.app/#/public. A real report and a real private note as anyone sees them, and the latest daily audit (PASS).
7. **Be the dealer:** https://tolmol-web-kappa.vercel.app/#/test-cards → "Who are you?" → a dealer licence. The phone gets "My shop", with the reports waiting for an answer first.

More if you have time: mid-day meals https://tolmol-web-kappa.vercel.app/#/shop/SYN-BR-5001, MGNREGA https://tolmol-web-kappa.vercel.app/#/shop/SYN-BR-7001. From a clone: `npm ci && npm test` (121 tests), and `npm run tolmol -- submit …` files a report without our website.

### Question 9. Pre-existing work

None. The first commit (0902494) contains only GitHub's generated LICENSE and .gitignore.

### Question 10. Arkiv surfaces used (tick these)

TypeScript SDK, Direct JSON-RPC, WebSocket events, Docs, Hub, Faucet, Block Explorer

### Question 11. Other surface

(leave empty)

### Question 12. First Arkiv entity

2 hours or less

### Question 13. LLMs used

Claude (Anthropic) via Claude Code.

### Question 14. One thing Arkiv should improve first

Make the anonymous read budget visible before it runs out. Today an app learns about the 10,000-unit budget only from the error that ends it, and the SDK's library then silently waits up to an hour, so reads look like a frozen app. Sending the remaining budget on every response, and clear error types in the SDK, would let apps warn users in time.

### Question 15. Feedback call

The builder's choice (suggested: Yes)

### Question 16. Our work, built 9–18 October, disclosed

Yes

### Question 17. Repo public under MIT, links accessible

Yes (tick after the `submission-v1` tag exists and every link opens in a private window)

### Question 18. Attending Devcon 8

Optional, the builder's choice (does not affect judging)
