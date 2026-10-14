# Verified card holders without revealing who they are (design)

> **Status: design, not built.** Nothing in the app, the SDK or on Arkiv claims verification today. This page is the
> plan for the open threats T9 (sybil) and T10 (collusion) in [`THREAT_MODEL.md`](THREAT_MODEL.md). Written 2026-10-14.

## The problem

Tolmol cannot tell whether a device belongs to a real card holder at that shop. One person with many phones, or a
dealer's friends, can add reports. Today we make that visible (burst patterns, confirmations from other devices) but
cannot prevent it.

## What we will not do, and why

| Idea | Why not |
|---|---|
| **Log in with Aadhaar or DigiLocker, and store the result** | DigiLocker gives documents only to organisations onboarded as "requesters" through API Setu ([partner SOP](https://cf-media.api-setu.in/resources/Partners-SOP.pdf)), and we would then hold names and card numbers. The rules forbid real personal data on Arkiv, **plaintext or hashed**. And a complaint system whose gate is run by the government being complained about is not censorship resistant |
| **Make verification mandatory** | The people most likely to be short-changed are often the ones whose fingerprints or OTPs fail ([`SOURCES.md`](SOURCES.md) §8). A required check would lock them out. Verification stays **optional**: unverified reports still count, verified ones carry a badge |
| **[Anon Aadhaar](https://github.com/anon-aadhaar/anon-aadhaar) on every report** | It proves "I hold a UIDAI-signed Aadhaar" in zero knowledge. But its anti-double-use value is `Hash(nullifierSeed, photo)` ([docs](https://documentation.anon-aadhaar.pse.dev/docs/nullifiers)). The seed must be public for readers to check it, and UIDAI holds every resident's photo, so on every report the state could compute the value and tell who filed which complaint. Used **once, to join the group**, it is much safer: see path 2 below |
| **Prove facts from the DigiLocker ration-card PDF** | Some states issue ration cards into DigiLocker as signed PDFs. [zkPDF](https://github.com/privacy-ethereum/zkpdf-template) (Privacy & Scaling Explorations) can prove facts from a signed PDF, but proving needs "at least 16GB RAM" or a remote prover network, which would see the card. Not possible on a card holder's phone today; worth revisiting when it runs in a browser |

## The design: verified at a camp, anonymous on Arkiv

It uses [Semaphore](https://github.com/semaphore-protocol/semaphore) (Ethereum Foundation, MIT): prove "I am one of
the members of this group" without saying which one. In the circuit, an identity's public value is
`Poseidon(public key)`, and the anti-double-use value is `Poseidon(scope, secret)`
([circuit source](https://github.com/semaphore-protocol/semaphore/blob/main/packages/circuits/src/semaphore.circom)).
The secret never leaves the phone, so **nobody else can compute it**: not the volunteer, not us, not the state.

1. **Accredited verifiers.** A social-audit group, NGO or gram-panchayat volunteer gets a verifier wallet. The
   registry wallet publishes one `tolmol.verifier` entity naming it.
2. **A camp at the shop.** The card holder shows their ration card **in person**. The volunteer writes nothing down:
   no name, no card number, no photo. The card holder's phone shows a QR of its Semaphore commitment (a random-looking
   number), and the volunteer's phone publishes one `tolmol.member` entity: "a verified card holder of shop X has
   commitment C".
3. **Reporting.** When that phone files a report, it also creates a Semaphore proof: "my commitment is in shop X's
   group, and this is my nullifier for scope = (shop, month, grain)". The proof is bound to the report's numbers
   through the `message` input, so it cannot be copied onto a different report.
4. **Reading.** Every browser rebuilds shop X's group from Arkiv, checks the proof, and shows "✓ verified card holder"
   on the report. The dashboard gets a "count only verified" view, like "only confirmed" today.

The volunteer knows which commitment belongs to which person, but reports carry only a nullifier and a group root, so
**even the volunteer cannot tell which report is whose**.

### Path 2: join from home with the Aadhaar QR code

For people who cannot reach a camp. Both paths add members to the **same** anonymous group; reports look identical.

1. The card holder scans the secure QR code printed on their own Aadhaar letter or e-Aadhaar, on their phone.
2. The phone makes an Anon Aadhaar proof: "this QR is signed by UIDAI", revealing only the **state** (nothing else:
   no name, number, photo, address or pincode), bound to the phone's Semaphore commitment through the proof's signal.
3. The phone publishes one `tolmol.member` entity with the commitment, the state, the Anon Aadhaar proof in the
   payload, and its join nullifier `Hash(seed, photo)` with `seed = "tolmol-join"`, so one Aadhaar can join only once.
   **It signs this with a throwaway wallet used for nothing else** (the per-report-ID mechanism already in the app).
   If the join and a report shared a `$creator`, the report would point straight back to the joining resident.
4. From then on, reports use the Semaphore proof exactly as in path 1, signed by the phone's usual or per-report IDs,
   never by the joining wallet.

**What the state could learn, and what it could not.** The join nullifier is computable by anyone holding the photo,
so UIDAI could tell that a given resident **joined Tolmol**. It could **not** tell which reports they filed: reports
carry only a Semaphore nullifier made from the phone's own secret, and the proof hides which member made it. Path 1
(camp) does not have even this leak, which is why it is the recommended path and path 2 is opt-in with that warning.

**Rules.** A join nullifier is a hash derived from a photo, which the hackathon rules forbid for real data. A Tolmol
build would therefore run path 2 **only in Anon Aadhaar's test mode, with UIDAI test QR codes** (synthetic), and a
real deployment would need a legal review under the Aadhaar Act and the DPDP Act 2023 first. It proves an Aadhaar,
not a ration card; with One Nation One Ration Card any card holder may use any shop, so "a unique resident of this
state" is still a real barrier to one person running many phones.

## How it uses Arkiv (no other database, no Tolmol server)

| Need | Arkiv feature | Detail |
|---|---|---|
| Who may add members | `$creator` + `createdBy()`, or a proof in the payload | `tolmol.verifier` entities count only from the registry wallet. A path-1 `tolmol.member` counts only if its `$creator` is named by a live verifier entity; a path-2 member counts only if its payload holds a valid Anon Aadhaar proof bound to its commitment and its join nullifier is the earliest with that value. Trust by creator or by proof, never by a field anyone can write |
| Revoking a verifier | Entity Expiration + Lifetime Extension | A verifier entity lives 180 days. The registry extends it while the verifier is trusted. If it lapses, every reader stops counting that verifier's members, with no delete and no server |
| Yearly re-verification | Entity Expiration | A member entity lives 365 days. A card holder re-verifies at the next camp; the verifier extends it |
| Rebuilding the group exactly as the prover saw it | `atBlock` + cursor pagination | Readers fetch shop X's members `.atBlock(report.createdAt)` and order them by creation block, then key (the same deterministic rule as report dedupe), so every browser builds the same Merkle tree and root |
| One verified report per person per shop, month and grain | Typed, indexed attribute | `zk_nullifier` (`key`) on the report; readers query `zk_nullifier = key(n)` and keep the earliest, like device dedupe today |
| The proof itself | Payload | The Groth16 proof (8 numbers) goes in the report payload as JSON. Payloads hold no personal data, only the proof |
| Unforgeable member list | Creation flags + atomic batch | Member entities are `readonly`; verifier entities stay owned by the registry so it can stop extending them |

### New entities (additive; `schema_version` stays 1)

| Type | Created by | Attributes | Lifetime |
|---|---|---|---|
| `tolmol.verifier` | registry wallet | `verifier` (the volunteer org's wallet address, public by design), `state`, `synthetic` | 180 days, extended by the registry |
| `tolmol.member` | an accredited verifier wallet (path 1), or the phone itself with an Anon Aadhaar proof in the payload (path 2) | `shop_id`, `state`, `commitment` (`key`), `verified_on` (u64, start of the day), `path` (`camp`/`aadhaar_qr`), `join_nullifier` (`key`, path 2 only), `synthetic` | 365 days, extended at re-verification |
| `tolmol.report` (2 new optional attributes) | the reporter's device | `zk_root` (`key`), `zk_nullifier` (`key`); payload = proof JSON | unchanged |

**Still kept off Arkiv:** names, card numbers, Aadhaar, photos, the identity secret, which person holds which
commitment, and anything the volunteer saw at the camp. The privacy audit and data contract would gain the two new
types, so `scripts/privacy-audit.ts` keeps checking every entity.

## What it does not solve

- **A dishonest verifier** can add fake members. Each member's `$creator` is its verifier, so per-verifier counts are
  public and a burst of members from one verifier is visible. The registry can let that verifier's entity expire.
- **Coercion at the camp**, or a dealer standing next to the volunteer. Camps should be run by groups card holders
  trust (social audits under NFSA s.28, for example).
- **Lost phone** = lost identity: re-verify at the next camp. Old reports stay valid.
- **Slow phones.** Proofs are made in the browser; the proving files are a few megabytes. Proving time on a low-end
  Android must be measured before this ships.
- **Who is a "real" card holder** still depends on a human looking at a card. This makes faking expensive and
  visible; it does not make it impossible.

## Plan

1. SDK: entity builders and parsers for `tolmol.verifier` and `tolmol.member`; group rebuild at a block; proof
   verification with `@semaphore-protocol/proof` in the browser; dedupe by `zk_nullifier`. Unit tests with fixed
   test vectors.
2. App: a "Verify at a camp" screen (show commitment QR) and a verifier screen (scan QR, publish member); the
   "✓ verified" badge and the "count only verified" view.
3. Seed: one synthetic verifier and a synthetic camp at one demo shop.
4. Path 2 (after path 1 works): Anon Aadhaar in test mode only, with UIDAI test QR codes; measure proving time and
   download size on a low-end Android before offering it.
5. Docs: `arkiv/schema.md`, data contract, privacy audit, threat model T9/T10, `ARKIV_USAGE.md`.

DigiLocker still has a place, off chain: a card holder escalating to the District Grievance Redressal Officer can
attach their own DigiLocker ration card to the paper complaint. That stays between them and the office, and never
touches Tolmol or Arkiv.
