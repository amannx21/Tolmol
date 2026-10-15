/** Every Tolmol entity carries `project = PROJECT`. Every query filters on it. */
export const PROJECT = "tolmol"
export const SCHEMA_VERSION = 1

export const TYPE = {
  shop: "tolmol.shop",
  /**
   * An outlet of another scheme (a school for school meals, a gram panchayat for MGNREGA wages). Same attributes as a
   * shop plus `scheme`. A separate type, so readers that only know ration shops never list a school as a ration shop.
   */
  outlet: "tolmol.outlet",
  report: "tolmol.report",
  witness: "tolmol.witness",
  /** Filed by a report's own creator to withdraw it. Honoured only when $creator matches the report's. */
  correction: "tolmol.correction",
} as const

/**
 * What went wrong at the shop, as a bitmask in one `issues` attribute (fewer attributes = less to read on the explorer).
 * Each value is a documented PDS problem; see docs/SOURCES.md. No free text is ever stored.
 */
export const ISSUES = {
  charged_money: 1, // asked to pay for grain that is free under PMGKAY
  auth_failed: 2, // fingerprint / OTP authentication failed, no grain given
  thumb_no_grain: 4, // thumbprint taken, but less or no grain handed over
  shop_closed: 8, // shop closed or not open on distribution day
  bad_quality: 16, // stones, insects, wet or spoilt grain
  portability_refused: 32, // One Nation One Ration Card holder from elsewhere turned away
  no_receipt: 64, // no receipt / ePoS slip given
  // Added 2026-10-15 (stored in a second attribute, `issues2`, so readers that only know `issues` still count the report).
  // Each is a problem card holders report in practice; see docs/SOURCES.md §13.
  slip_mismatch: 128, // the machine slip / record shows more grain than was handed over
  no_weighing: 256, // grain not weighed in front of the card holder
  tied_sale: 512, // made to buy other items (dal, salt, oil, soap) to get the ration
  card_kept: 1024, // dealer kept the ration card (TPDS Control Order 2015 cl. 10(3) forbids it)
  no_board: 2048, // no board with entitlement, price, timings and stock (cl. 10(4)(ii))
  told_lapsed: 4096, // told the ration "lapsed" or "did not come" this month
  many_trips: 8192, // had to come 3 or more times (network, authentication, shop shut)
  wrong_grain: 16384, // given a different grain, or none of one grain
  threatened: 32768, // scolded or threatened for asking or complaining
  member_left_out: 65536, // a family member's share was left out
} as const
export type IssueName = keyof typeof ISSUES
export const ISSUE_NAMES = Object.keys(ISSUES) as IssueName[]
export const ALL_ISSUES_MASK = Object.values(ISSUES).reduce((a, b) => a | b, 0)
export const issueList = (mask: number): IssueName[] => ISSUE_NAMES.filter((n) => (mask & ISSUES[n]) !== 0)

/** The first 7 flags live in `issues`; the rest, shifted down by 7, in `issues2` (written only when non-zero). */
export const ISSUES_LOW_BITS = 7
export const ISSUES_LOW_MASK = (1 << ISSUES_LOW_BITS) - 1
export const ISSUES2_MASK = ALL_ISSUES_MASK >> ISSUES_LOW_BITS

/** Questions grouped the way a card holder thinks about them (used by the report screens). */
export const ISSUE_GROUPS: { id: "grain" | "money" | "access" | "conduct"; issues: IssueName[] }[] = [
  { id: "grain", issues: ["thumb_no_grain", "slip_mismatch", "no_weighing", "wrong_grain", "member_left_out", "bad_quality"] },
  { id: "money", issues: ["charged_money", "tied_sale", "no_receipt"] },
  { id: "access", issues: ["auth_failed", "shop_closed", "many_trips", "told_lapsed", "portability_refused"] },
  { id: "conduct", issues: ["card_kept", "threatened", "no_board"] },
]


/** Reports and witnesses are handed to this address in the same batch that creates them, so nobody can delete them. */
export const BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD" as const

/** The registry wallet that publishes the synthetic shop list. The app trusts shops only from this creator. */
export const DEFAULT_REGISTRY = "0x6DBf6A36E27d814c58A05312913DCEEfc0dAe221" as const

/** "total" = all grain together, which is how families usually think about their entitlement (Easy mode). */
export const ITEMS = ["rice", "wheat", "millet", "total"] as const
export type Item = (typeof ITEMS)[number]

/** Tiramisu produces a block every 2 seconds. */
export const BLOCK_SECONDS = 2
export const BLOCKS_PER_DAY = 43_200n

/** Lifetimes a reporter may choose for their own report (Privacy: expiry the user controls). */
export const REPORT_LIFETIME_CHOICES = [30, 90, 180] as const

export const LIFETIME_DAYS = {
  shop: 180,
  report: 90,
  /** Target lifetime once a report has 2+ distinct witnesses. */
  corroborated: 180,
  /** App policy: a report is never extended beyond createdAt + this. */
  cap: 365,
} as const

/** A report needs this many distinct witnesses before corroboration extends its life. */
export const MIN_WITNESSES_TO_EXTEND = 2

/** The public RPC rejects request bodies over 262,144 bytes; about 57 creates of our shape fit. */
export const MAX_CREATES_PER_BATCH = 40

/** Validation bounds for quantities, in grams. */
export const MAX_ENTITLED_G = 100_000

/** NFSA entitlements (nfsa.gov.in, verified 2026-10-13): PHH 5 kg per person per month; AAY 35 kg per family per month. */
export const NFSA = { phhPerPersonG: 5_000, aayPerFamilyG: 35_000 } as const

export const EXPLORER = "https://tiramisu.explorer.arkiv.network"
export const explorerEntityUrl = (key: string) => `${EXPLORER}/entity/${key}`
export const explorerTxUrl = (hash: string) => `${EXPLORER}/tx/${hash}`
export const explorerAddressUrl = (address: string) => `${EXPLORER}/address/${address}`
