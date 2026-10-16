// Everything about one outlet, or one state, in ONE query. Every Tolmol record that belongs to an outlet carries its
// `shop_id` (and its `state`), so `project = "tolmol" AND shop_id = X` returns the outlet's reports, confirmations,
// withdrawals, answers, follow-ups, boards, official actions, delegations, notes and full shares together, each then
// checked by its own strict parser. A shop page needs one query (one page of up to 200 records) instead of ten, and a
// state dashboard a few pages instead of a dozen queries: the anonymous read budget (friction F13, F14) lasts a
// visitor several times longer. The trust rules are unchanged: they run on the parsed records exactly as before.
import { str } from "@arkiv-network/sdk/attr"
import { eq, type Expression } from "@arkiv-network/sdk/query"
import type { Followup, Response } from "./answers.js"
import { parseFollowup, parseResponse } from "./answers.js"
import type { RawEntity } from "./attributes.js"
import { parseCorrection, parseReport, parseWitness } from "./attributes.js"
import type { OutletBoard } from "./boards.js"
import { parseBoard } from "./boards.js"
import { PROJECT } from "./constants.js"
import type { Delegation } from "./delegation.js"
import { parseDelegation } from "./delegation.js"
import type { FullShare } from "./fullshare.js"
import { parseFullShare } from "./fullshare.js"
import type { Correction, Report, Witness } from "./model.js"
import type { Note } from "./notes.js"
import { parseNote } from "./notes.js"
import type { OfficialRecord } from "./official.js"
import { parseOfficialAction } from "./official.js"
import type { Reader, ReadOptions } from "./queries.js"
import type { StockBoard } from "./stock.js"
import { parseStock } from "./stock.js"

export type TolmolRecord = {
  atBlock: bigint
  /** Records of a known type that failed their parser (left out, as in every other query). */
  dropped: number
  reports: Report[]
  witnesses: Witness[]
  corrections: Correction[]
  responses: Response[]
  followups: Followup[]
  stocks: StockBoard[]
  boards: OutletBoard[]
  actions: OfficialRecord[]
  delegations: Delegation[]
  notes: Note[]
  fullShares: FullShare[]
}

const SELECT = {
  key: true,
  creator: true,
  owner: true,
  createdAt: true,
  expiresAt: true,
  creationFlags: true,
  attributes: true,
  payload: true,
} as const

/** One query (all its pages, pinned at one block), each record routed to its type's parser. */
export async function recordsWhere(
  client: Reader,
  where: Expression[],
  opts: ReadOptions = {},
): Promise<TolmolRecord> {
  const atBlock = opts.atBlock ?? (await client.getBlockNumber({ cacheTime: 0 }))
  const out: TolmolRecord = {
    atBlock,
    dropped: 0,
    reports: [],
    witnesses: [],
    corrections: [],
    responses: [],
    followups: [],
    stocks: [],
    boards: [],
    actions: [],
    delegations: [],
    notes: [],
    fullShares: [],
  }
  const route: Record<string, (e: RawEntity) => boolean> = {
    "tolmol.report": (e) => push(out.reports, parseReport(e)),
    "tolmol.witness": (e) => push(out.witnesses, parseWitness(e)),
    "tolmol.correction": (e) => push(out.corrections, parseCorrection(e)),
    "tolmol.response": (e) => push(out.responses, parseResponse(e)),
    "tolmol.followup": (e) => push(out.followups, parseFollowup(e)),
    "tolmol.stock": (e) => push(out.stocks, parseStock(e)),
    "tolmol.board": (e) => push(out.boards, parseBoard(e)),
    "tolmol.action": (e) => push(out.actions, parseOfficialAction(e)),
    "tolmol.delegation": (e) => push(out.delegations, parseDelegation(e)),
    "tolmol.note": (e) => push(out.notes, parseNote(e)),
    "tolmol.fullshare": (e) => push(out.fullShares, parseFullShare(e)),
  }
  const maxPages = opts.maxPages ?? 25
  let page = await client.select(SELECT).where(where).limit(200).atBlock(atBlock).fetch()
  for (let pages = 1; ; pages++) {
    for (const e of page.entities) {
      const type = (e as RawEntity).attributes?.type?.value
      const parse = typeof type === "string" ? route[type] : undefined
      // Registry entries, verification records and test entities are read elsewhere; they are skipped here.
      if (parse && !parse(e as RawEntity)) out.dropped++
    }
    if (!page.hasNextPage()) break
    if (pages >= maxPages) throw new Error(`query needs more than ${maxPages} pages; narrow the filter`)
    page = await page.next()
  }
  return out
}
function push<T>(list: T[], v: T | null): boolean {
  if (v) list.push(v)
  return !!v
}

/** Q30: everything about one outlet, in one query. */
export const outletRecord = (c: Reader, shopId: string, o: ReadOptions = {}) =>
  recordsWhere(c, [eq("project", str(PROJECT)), eq("shop_id", str(shopId))], o)
/** Q31: everything in one state, in one query (a few pages). */
export const stateRecord = (c: Reader, state: string, o: ReadOptions = {}) =>
  recordsWhere(c, [eq("project", str(PROJECT)), eq("state", str(state))], o)
