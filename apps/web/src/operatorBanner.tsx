// For a phone verified as an outlet's operator (a ration shop's dealer, a school's head teacher, a panchayat's
// employment assistant): its job, on every page. Card holders and visitors never see any of this.
import { useEffect, useState } from "preact/hooks"
import { dedupeReports, validResponses } from "tolmol-sdk"
import { shopReports, shopResponses } from "./reads"
import { ActionIcon } from "./ActionIcon"
import { device, reader } from "./arkiv"
import { outletKey, useLang } from "./i18n"
import type { Route } from "./router"
import { loadOutlets } from "./ui"
import { useDealers } from "./verified"

type Op = { shopId: string; scheme: "pds" | "mdm" | "nrega" }

/** The outlet this phone answers for, or null. */
export function useOperator(): Op | null {
  const dealers = useDealers()
  const mine = dealers?.get(device().account.address.toLowerCase())
  const [scheme, setScheme] = useState<Op["scheme"]>("pds")
  useEffect(() => {
    if (mine) void loadOutlets().then((all) => setScheme(all.find((s) => s.shopId === mine.shopId)?.scheme ?? "pds"), () => undefined)
  }, [mine?.shopId])
  return mine ? { shopId: mine.shopId, scheme } : null
}

/** "You are the verified dealer of … · N reports waiting · Open my shop", under the menu on every page but the dashboard and report pages. */
export function OperatorBanner({ route }: { route: Route }) {
  const { t } = useLang()
  const op = useOperator()
  const dealers = useDealers()
  const [waiting, setWaiting] = useState<number | null>(null)
  useEffect(() => {
    if (!op || !dealers) return
    let live = true
    Promise.all([shopReports(reader, op.shopId), shopResponses(reader, op.shopId)])
      .then(([rs, as]) => {
        const counted = dedupeReports(rs.items).filter((r) => r.shortfallG > 0)
        const answered = validResponses(counted, as.items, dealers)
        if (live) setWaiting(counted.filter((r) => !answered.has(r.key.toLowerCase())).length)
      })
      .catch(() => live && setWaiting(null))
    return () => {
      live = false
    }
  }, [op?.shopId, dealers])
  // Not on the dashboard itself, nor on a report, where the answer buttons already come first.
  if (!op || route.name === "myOutlet" || route.name === "r") return null
  return (
    <div class="operator-banner" role="note">
      <span class="operator-banner-icon" aria-hidden="true">
        <ActionIcon name="shop" />
      </span>
      <span class="operator-banner-text">
        <strong>{t(outletKey("roleDealerTitle", op.scheme), { shop: op.shopId })}</strong>
        {waiting ? <span>{t("roleDealerWaiting", { n: waiting })}</span> : null}
      </span>
      <a class="button" href="#/my-outlet">
        {t(outletKey("roleDealerAction", op.scheme))} →
      </a>
    </div>
  )
}
