// One ledger, several entitlement schemes. The same evidence model (a sealed report of "what I was due and what I got",
// confirmed by others, answered by the outlet, acted on by officials) fits any scheme where a person is owed a fixed
// amount at a known place:
//   pds    ration at a fair-price shop (National Food Security Act 2013), in grams
//   mdm    hot cooked school meals (PM POSHAN), in school days with a meal
//   nrega  wages for rural work (Mahatma Gandhi NREGA 2005), in rupees
// Ration shops are `tolmol.shop` entities from the registry (unchanged); schools and gram panchayats are
// `tolmol.outlet` entities from the same registry with a `scheme` attribute, so ration-only readers never list them. Reports keep their shape: `entitled_g`,
// `received_g` and `shortfall_g` hold whole units of the item (grams, days or rupees, see ITEM_INFO), and a report for
// a non-ration scheme also carries `scheme`. A reader that only knows ration items drops these reports instead of
// misreading rupees as grams, because their `item` is not one it knows.
import { ISSUE_GROUPS, ISSUES, ITEMS } from "./constants.js"

export const SCHEMES = ["pds", "mdm", "nrega"] as const
export type Scheme = (typeof SCHEMES)[number]
export const isScheme = (v: unknown): v is Scheme => typeof v === "string" && (SCHEMES as readonly string[]).includes(v)

/** Items of the non-ration schemes. Ration items are ITEMS (rice, wheat, millet, total). */
export const SCHEME_ITEMS = ["meal_days", "wage_inr"] as const
export const ALL_ITEMS = [...ITEMS, ...SCHEME_ITEMS] as const
export type AnyItem = (typeof ALL_ITEMS)[number]

/** The unit a report's amounts are counted in. All amounts are whole numbers. */
export type Unit = "g" | "day" | "inr"

export const ITEM_INFO: Record<AnyItem, { scheme: Scheme; unit: Unit; max: number }> = {
  rice: { scheme: "pds", unit: "g", max: 100_000 },
  wheat: { scheme: "pds", unit: "g", max: 100_000 },
  millet: { scheme: "pds", unit: "g", max: 100_000 },
  total: { scheme: "pds", unit: "g", max: 100_000 },
  // School days in the month the school was open, and days the child got a hot cooked meal.
  meal_days: { scheme: "mdm", unit: "day", max: 31 },
  // Wages owed for the days worked in the month, and wages paid, in whole rupees.
  wage_inr: { scheme: "nrega", unit: "inr", max: 100_000 },
}
export const schemeOfItem = (item: AnyItem): Scheme => ITEM_INFO[item].scheme
export const itemsOfScheme = (scheme: Scheme): AnyItem[] => ALL_ITEMS.filter((i) => ITEM_INFO[i].scheme === scheme)

/**
 * What else went wrong, per scheme, as a bitmask in `issues` (and `issues2` for ration reports only). Each flag is a
 * problem people face under that scheme; see docs/SOURCES.md §14 and §15. No free text is ever stored.
 */
export const SCHEME_ISSUES: Record<Scheme, Readonly<Record<string, number>>> = {
  pds: ISSUES,
  mdm: {
    poor_meal: 1, // food spoilt, undercooked, insects or stones
    less_food: 2, // portion smaller than the child needs
    menu_ignored: 4, // the notified menu (dal, vegetables, eggs or fruit where given) not followed
    unsafe_kitchen: 8, // dirty kitchen, no clean drinking water
    seated_apart: 16, // children made to sit or eat separately (discrimination)
    money_asked: 32, // parents asked to pay or contribute for the meal
    children_work: 64, // children made to cook, clean or serve
  },
  nrega: {
    wage_late: 1, // wages not paid within 15 days of the work (MGNREGA s.3(3))
    paid_less: 2, // paid for fewer days, or a lower rate, than worked
    job_card_kept: 4, // the household's job card kept by someone else
    work_denied: 8, // asked for work, not given within 15 days (MGNREGA s.7)
    no_site_facilities: 16, // no drinking water, shade or first aid at the worksite (Schedule II)
    bribe_asked: 32, // asked to pay to get work or wages
    fake_names: 64, // the muster roll lists people who did not work
  },
}
export const schemeIssueMask = (scheme: Scheme) => Object.values(SCHEME_ISSUES[scheme]).reduce((a, b) => a | b, 0)
export const schemeIssueNames = (scheme: Scheme) => Object.keys(SCHEME_ISSUES[scheme])
export const schemeIssueList = (scheme: Scheme, mask: number) => schemeIssueNames(scheme).filter((n) => (mask & SCHEME_ISSUES[scheme][n]!) !== 0)

/** The questions grouped as a person thinks about them, one screen per group. */
export const SCHEME_ISSUE_GROUPS: Record<Scheme, { id: string; issues: string[] }[]> = {
  pds: ISSUE_GROUPS,
  mdm: [
    { id: "meal", issues: ["poor_meal", "less_food", "menu_ignored"] },
    { id: "school", issues: ["unsafe_kitchen", "seated_apart", "children_work", "money_asked"] },
  ],
  nrega: [
    { id: "wages", issues: ["wage_late", "paid_less", "fake_names"] },
    { id: "work", issues: ["work_denied", "no_site_facilities", "job_card_kept", "bribe_asked"] },
  ],
}

/** An amount in the item's unit, in plain English: "4.5 kg", "18 days", "₹2,400". */
export function formatAmount(item: AnyItem, n: number): string {
  const unit = ITEM_INFO[item].unit
  if (unit === "day") return `${n} ${n === 1 ? "day" : "days"}`
  if (unit === "inr") return `₹${n.toLocaleString("en-IN")}`
  const kg = Math.floor(n / 1000)
  const g = n % 1000
  return g === 0 ? `${kg} kg` : `${kg}.${String(g).padStart(3, "0").replace(/0+$/, "")} kg`
}

/**
 * MGNREGA muster rolls are public by law (name, days worked, wage). An exact "owed ₹3,000, paid ₹1,750" can be matched
 * to one name on the roll, so wage reports are rounded before they are written: the amount owed to the nearest `step`
 * rupees (at least one step), and the amount paid to the nearest step at the same share of what was owed. The shortfall
 * stays close to the truth (within half a step), and the exact days worked are no longer readable from the record.
 */
export function coarsenWages(owed: number, paid: number, step = 500): { owed: number; paid: number } {
  if (!Number.isSafeInteger(owed) || !Number.isSafeInteger(paid) || owed <= 0 || paid < 0 || paid > owed) throw new Error("owed and paid must be whole rupees, 0 <= paid <= owed")
  const o = Math.max(step, Math.round(owed / step) * step)
  const p = Math.min(o, Math.round(((paid / owed) * o) / step) * step)
  return { owed: o, paid: p }
}
