/** Every Tolmol entity carries `project = PROJECT`. Every query filters on it. */
export const PROJECT = "tolmol"
export const SCHEMA_VERSION = 1

export const TYPE = {
  shop: "tolmol.shop",
  report: "tolmol.report",
  witness: "tolmol.witness",
} as const

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
