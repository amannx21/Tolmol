import { ExpirationTime, type WalletArkivClient } from "@arkiv-network/sdk"
import type { Account } from "viem"
import { reportAttributes, witnessAttributes } from "./attributes.js"
import { BURN_ADDRESS, LIFETIME_DAYS } from "./constants.js"
import { validateReportInput, type Report, type Shop, type Witness } from "./model.js"
import { getReport, myExistingReport, reportWitnesses, type Reader } from "./queries.js"
import { extensionTarget, validWitnesses } from "./rules.js"

type Hex = `0x${string}`
export type Writer = WalletArkivClient & { account: Account }

export class DuplicateError extends Error {
  constructor(
    message: string,
    readonly existingKey: Hex,
  ) {
    super(message)
    this.name = "DuplicateError"
  }
}
export class SelfWitnessError extends Error {
  constructor() {
    super("A report cannot be corroborated by the wallet that wrote it")
    this.name = "SelfWitnessError"
  }
}
export class ReportNotFoundError extends Error {
  constructor(key: string) {
    super(`No live, valid Tolmol report with key ${key}`)
    this.name = "ReportNotFoundError"
  }
}

const EMPTY = new Uint8Array()
const CONTENT_TYPE = "application/octet-stream"
const FLAGS = { readonly: true, permissionlessExtension: true } as const
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

export type WriteResult = { entityKey: Hex; txHash: Hex }

/**
 * Files one report: validates it, refuses a duplicate from this wallet, then in ONE atomic batch
 * creates the report (readonly + permissionlessExtension, 90 days) and hands it to the burn address,
 * so nobody (not even its reporter) can later edit or delete it.
 */
export async function submitReport(
  reader: Reader,
  writer: Writer,
  rawInput: unknown,
  shop: Pick<Shop, "shopId" | "state" | "district">,
  opts: { synthetic: boolean; now?: Date; /** Caller already checked for a duplicate (saves one query). */ skipDuplicateCheck?: boolean } = { synthetic: true },
): Promise<WriteResult> {
  const input = validateReportInput(rawInput, opts.now)
  if (input.shopId !== shop.shopId) throw new Error("shop does not match the report's shopId")
  const me = writer.account.address
  if (!opts.skipDuplicateCheck) {
    const existing = await myExistingReport(reader, me, input)
    if (existing) throw new DuplicateError("You already reported this shop, month and item", existing.key)
  }

  const [predicted] = await reader.predictEntityKeys({ owner: me, count: 1 })
  if (!predicted) throw new Error("could not predict the entity key")
  const res = await writer.executeBatch({
    creates: [
      {
        payload: EMPTY,
        contentType: CONTENT_TYPE,
        attributes: reportAttributes(input, shop, {
          synthetic: opts.synthetic,
          reportedAtMs: BigInt((opts.now ?? new Date()).getTime()),
        }),
        expires: ExpirationTime.fromDays(LIFETIME_DAYS.report),
        flags: FLAGS,
        salt: predicted.salt,
      },
    ],
    ownershipChanges: [{ entityKey: predicted.key, newOwner: BURN_ADDRESS }],
  })
  const created = res.createdEntities[0]
  if (!created || !same(created, predicted.key)) {
    throw new Error(`created key ${created} does not match predicted ${predicted.key}; reconcile before retrying`)
  }
  return { entityKey: created, txHash: res.txHash }
}

export type CorroborateResult = WriteResult & { witnessesAfter: number; extendedTo: bigint | null }

/**
 * Corroborates a report from a different wallet. One atomic batch:
 *  1. create the witness entity (readonly + permissionlessExtension) with the report's deadline,
 *  2. hand it to the burn address,
 *  3. if the report now has 2+ distinct witnesses: extend the report and its live witnesses
 *     to max(current, head + 180 days), capped at report.createdAt + 365 days.
 * Retries once if another witness extended the report in between (ExpiryNotExtended).
 */
export async function corroborate(
  reader: Reader,
  writer: Writer,
  reportKey: Hex,
  opts: {
    synthetic: boolean
    now?: Date
    /** Already-read report and its witnesses (saves three queries). Used on the first attempt only. */
    known?: { report: Report; witnesses: Witness[] }
  } = { synthetic: true },
): Promise<CorroborateResult> {
  const me = writer.account.address
  for (let attempt = 0; ; attempt++) {
    const known = attempt === 0 ? opts.known : undefined
    const report: Report | null = known?.report ?? (await getReport(reader, reportKey))
    if (!report) throw new ReportNotFoundError(reportKey)
    if (same(report.creator, me)) throw new SelfWitnessError()
    const head = await reader.getBlockNumber({ cacheTime: 0 })
    const all = known?.witnesses ?? (await reportWitnesses(reader, report.key, { atBlock: head })).items
    const mine = all.find((w) => same(w.creator, me) && same(w.reportKey, report.key))
    if (mine) throw new DuplicateError("You already corroborated this report", mine.key)
    const existing = validWitnesses(report, all)
    const after = existing.length + 1
    const target = extensionTarget(report, after, head)
    const deadline = target ?? report.expiresAt

    const [predicted] = await reader.predictEntityKeys({ owner: me, count: 1 })
    if (!predicted) throw new Error("could not predict the entity key")
    const extensions = target
      ? [
          { entityKey: report.key, expires: ExpirationTime.atBlock(target) },
          ...existing.filter((w) => w.expiresAt < target).map((w) => ({ entityKey: w.key, expires: ExpirationTime.atBlock(target) })),
        ]
      : []
    try {
      const res = await writer.executeBatch({
        creates: [
          {
            payload: EMPTY,
            contentType: CONTENT_TYPE,
            attributes: witnessAttributes(report, {
              synthetic: opts.synthetic,
              reportedAtMs: BigInt((opts.now ?? new Date()).getTime()),
            }),
            // Same deadline as the report, but never dead on arrival if the report is about to expire.
            expires: ExpirationTime.atBlock(deadline, { atLeast: ExpirationTime.fromHours(1) }),
            flags: FLAGS,
            salt: predicted.salt,
          },
        ],
        extensions,
        ownershipChanges: [{ entityKey: predicted.key, newOwner: BURN_ADDRESS }],
      })
      const created = res.createdEntities[0]
      if (!created || !same(created, predicted.key)) {
        throw new Error(`created key ${created} does not match predicted ${predicted.key}; reconcile before retrying`)
      }
      return { entityKey: created, txHash: res.txHash, witnessesAfter: after, extendedTo: target }
    } catch (e) {
      const msg = String((e as Error)?.message ?? e)
      // Another witness extended the report first: re-read and recompute once.
      if (attempt === 0 && /would shorten its life|ExpiryNotExtended/i.test(msg)) continue
      throw e
    }
  }
}
