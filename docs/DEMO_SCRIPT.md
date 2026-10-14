# Demo video script (3:00 max)

Record at 1080p. Two browser windows side by side: **A** (left, normal profile) and **B** (right, a second
profile or guest window, so it has its own device key). Phone-width windows look best (about 420 px wide).
Open beforehand: A on the live app's Dashboard (Bihar), B on the Home page, a terminal, and the explorer.

| Time | Screen | Say (roughly) |
|---|---|---|
| 0:00-0:20 | README "The problem" section | "81 crore Indians get free grain from 5 lakh ration shops. ICRIER estimates about 28% never reaches them. When a dealer gives you 4 kg instead of 5, there is no neutral record. Tolmol makes one." |
| 0:20-0:35 | A: Dashboard, Live badge | "This is live data on Arkiv's Tiramisu testnet. All shops are synthetic. The ranking comes straight from Arkiv queries in this browser; there is no Tolmol server." |
| 0:35-0:55 | B in Easy mode, Hindi, read-aloud on: "मुझे कम राशन मिला", shop, this month, priority household, 5 people, set 20 kg received, Save | "Easy mode: one question at a time, read aloud in Hindi, no typing. An anonymous key on the phone, not a login. Once saved, nobody, not even me, can edit or delete it." |
| 0:55-1:05 | B: report page, then explorer link | "Creator is my device. Owner is 0x…dEaD: in the same transaction it was handed to an address nobody controls." |
| 1:05-1:20 | A: open the shared report link, get gas, tap "I also got less at this shop this month"; then A's dashboard row flashes | "A second card holder confirms it from their own phone. The dashboard updated by itself: Arkiv pushed the event over WebSocket." |
| 1:20-2:00 | README "Why Arkiv" table | "On Postgres, we or anyone who leans on us could delete this. With our own API we decide what to serve. IPFS can't answer 'all shortfalls at this shop in October' without an indexer. On Arkiv the query layer is the network, authorship is set by the protocol, and readonly plus the burn transfer means no one can delete. What we keep off chain: names, phones, Aadhaar, photos, free text." |
| 2:00-2:25 | Terminal: `npm run tolmol -- query --shop SYN-BR-0042`, then `--at-block <block before the new report>` | "If our website is gone, anyone can still read the evidence with the CLI or curl. And this is the shop as it was at an earlier block: proof of what was on record when." |
| 2:25-2:35 | B: the "What you can do now" panel after the report (1967, DGRO complaint, RTI) | "After a report, the app says what to do next: call the 1967 food helpline, or print a complaint to the district grievance officer or an RTI, in Hindi, with the evidence attached. No name is ever stored; those are blanks on paper." |
| 2:35-2:50 | `arkiv/friction.md` headings | "We logged 13 issues with repro steps, like the RPC's 262 KB request limit that shows up as 'execution error', and the anonymous query budget that looks like a hang." |
| 2:50-3:00 | README track section | "Best Indian Use Case first; also all four CROPS pillars. MIT, a documented data contract, a privacy audit anyone can run, synthetic data. Thank you." |

Checklist before recording: relayer has GLM; both browser profiles are fresh (or B has gas); the dashboard is on
Bihar; terminal font large; no `.env` or key visible anywhere on screen.
