// Fewer reads for every visitor. The SDK's per-outlet and per-state queries, with the same names and arguments, served
// from ONE combined read: everything about an outlet (`project AND shop_id = X`) or a state (`project AND state = S`),
// see tolmol-sdk records.ts. A shop page then costs one query instead of about ten, and a dashboard a few pages instead
// of a dozen queries; within 30 seconds a second component asking the same thing costs nothing. Components only change their import line.
// The trust rules run on the parsed records exactly as before. A historic read ("as it was at block N") still uses the
// SDK's own queries with `atBlock` (ShopPage). Any write from this phone clears the cache, so new records show at once.
import { outletRecord, stateRecord, type Reader, type ReadResult, type TolmolRecord } from "tolmol-sdk"

const TTL_MS = 30_000
const cache = new Map<string, { at: number; p: Promise<TolmolRecord> }>()

/** Called after every write from this phone (see arkiv.ts): the next read is fresh. */
export function clearReadCache() {
  cache.clear()
}

function cached(key: string, load: () => Promise<TolmolRecord>): Promise<TolmolRecord> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.p
  const p = load()
  cache.set(key, { at: Date.now(), p })
  p.catch(() => {
    if (cache.get(key)?.p === p) cache.delete(key)
  })
  return p
}

/** The outlet's records in one query. (Not cut out of a state read: the per-outlet query matches on `shop_id` alone,
 *  and the result must be exactly what it would return.) */
const outlet = (r: Reader, shopId: string) => cached(`o:${shopId}`, () => outletRecord(r, shopId))
const stateRec = (r: Reader, state: string) => cached(`s:${state}`, () => stateRecord(r, state))
const res = <T>(rec: TolmolRecord, items: T[]): ReadResult<T> => ({ items, atBlock: rec.atBlock, dropped: 0 })
const inMonth = <T extends { month: string }>(xs: T[], month?: string) =>
  month ? xs.filter((x) => x.month === month) : xs

// ---- per outlet (same signatures as the SDK; `atBlock` options are ignored: these always read the latest state)
export const shopReports = (r: Reader, shopId: string, month?: string, _o?: unknown) =>
  outlet(r, shopId).then((x) => res(x, inMonth(x.reports, month)))
export const shopWitnesses = (r: Reader, shopId: string, month?: string, _o?: unknown) =>
  outlet(r, shopId).then((x) => res(x, inMonth(x.witnesses, month)))
export const shopCorrections = (r: Reader, shopId: string, month?: string, _o?: unknown) =>
  outlet(r, shopId).then((x) => res(x, inMonth(x.corrections, month)))
export const shopResponses = (r: Reader, shopId: string, _o?: unknown) =>
  outlet(r, shopId).then((x) => res(x, x.responses))
export const shopFollowups = (r: Reader, shopId: string, _o?: unknown) =>
  outlet(r, shopId).then((x) => res(x, x.followups))
export const shopStocks = (r: Reader, shopId: string, _o?: unknown) =>
  outlet(r, shopId).then((x) => res(x, x.stocks))
export const shopBoards = (r: Reader, shopId: string, _o?: unknown) =>
  outlet(r, shopId).then((x) => res(x, x.boards))
export const shopOfficialActions = (r: Reader, shopId: string, _o?: unknown) =>
  outlet(r, shopId).then((x) => res(x, x.actions))
export const shopDelegations = (r: Reader, shopId: string, _o?: unknown) =>
  outlet(r, shopId).then((x) => res(x, x.delegations))
export const shopNotesTo = (r: Reader, shopId: string, to: string, _o?: unknown) =>
  outlet(r, shopId).then((x) =>
    res(
      x,
      x.notes.filter((n) => n.to === to.toLowerCase()),
    ),
  )
export const shopFullShares = (r: Reader, shopId: string, month: string, _o?: unknown) =>
  outlet(r, shopId).then((x) => res(x, inMonth(x.fullShares, month)))

// ---- per state
export const stateOfficialActions = (r: Reader, state: string, _o?: unknown) =>
  stateRec(r, state).then((x) => res(x, x.actions))
export const stateDelegations = (r: Reader, state: string, _o?: unknown) =>
  stateRec(r, state).then((x) => res(x, x.delegations))
export const stateCorrections = (r: Reader, state: string, _o?: unknown) =>
  stateRec(r, state).then((x) => res(x, x.corrections))
export const stateResponses = (r: Reader, state: string, _o?: unknown) =>
  stateRec(r, state).then((x) => res(x, x.responses))
export const stateFollowups = (r: Reader, state: string, _o?: unknown) =>
  stateRec(r, state).then((x) => res(x, x.followups))
export function dashboardReports(
  r: Reader,
  f: { state: string; fromMonth: string; toMonth: string; district?: string; minShortfallBp?: number },
  _o?: unknown,
) {
  const from = Number(f.fromMonth.replace("-", "")),
    to = Number(f.toMonth.replace("-", ""))
  return stateRec(r, f.state).then((x) =>
    res(
      x,
      x.reports.filter(
        (rep) =>
          rep.monthNum >= from &&
          rep.monthNum <= to &&
          (!f.district || rep.district === f.district) &&
          (f.minShortfallBp === undefined || rep.shortfallBp >= f.minShortfallBp),
      ),
    ),
  )
}
export const dashboardWitnesses = (r: Reader, f: { state: string; months: string[] }, _o?: unknown) =>
  stateRec(r, f.state).then((x) =>
    res(
      x,
      x.witnesses.filter((w) => f.months.includes(w.month)),
    ),
  )
