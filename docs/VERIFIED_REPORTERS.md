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
| **[Anon Aadhaar](https://github.com/anon-aadhaar/anon-aadhaar) as the main path** | It proves "I hold a UIDAI-signed Aadhaar" in zero knowledge, which is clever. But its anti-double-use value is `Hash(nullifierSeed, photo)` ([docs](https://documentation.anon-aadhaar.pse.dev/docs/nullifiers)). The seed would have to be public for every reader to check it, and UIDAI holds every resident's photo, so the state could compute the value for everyone and tell who filed which complaint. It is also a hash of personal data on chain. At most a test-mode demo with UIDAI's test QR codes, never real cards |

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

## How it uses Arkiv (no other database, no Tolmol server)

| Need | Arkiv feature | Detail |
|---|---|---|
| Who may verify | `$creator` + `createdBy()` | `tolmol.verifier` entities count only from the registry wallet; `tolmol.member` entities count only from a wallet named by a live verifier entity. Trust by creator, never by a field |
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
| `tolmol.member` | an accredited verifier wallet | `shop_id`, `state`, `commitment` (`key`), `verified_on` (u64, start of the day), `synthetic` | 365 days, extended at re-verification |
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
4. Docs: `arkiv/schema.md`, data contract, privacy audit, threat model T9/T10, `ARKIV_USAGE.md`.

DigiLocker still has a place, off chain: a card holder escalating to the District Grievance Redressal Officer can
attach their own DigiLocker ration card to the paper complaint. That stays between them and the office, and never
touches Tolmol or Arkiv.
