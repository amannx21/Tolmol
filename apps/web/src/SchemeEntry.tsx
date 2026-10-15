import type { ComponentChildren } from "preact"
import { useEffect, useState } from "preact/hooks"
import type { Scheme } from "tolmol-sdk"
import { SchemeChooser, SchemeReport } from "./SchemeReport"
import { Loading, loadOutlets } from "./ui"

/**
 * The report page for every scheme. A link or QR with `?shop=` opens the right flow for that outlet (a school's QR
 * opens the school-meal questions); otherwise `?scheme=` picks it, and the ration flows (children) are the default.
 */
export function ReportEntry({ shopId, scheme, children }: { shopId?: string; scheme?: Scheme; children: ComponentChildren }) {
  const [fromShop, setFromShop] = useState<Scheme | null | undefined>(shopId ? undefined : null)
  useEffect(() => {
    if (!shopId) return setFromShop(null)
    loadOutlets()
      .then((all) => setFromShop(all.find((s) => s.shopId === shopId)?.scheme ?? null))
      .catch(() => setFromShop(null))
  }, [shopId])
  if (fromShop === undefined) return <Loading />
  const active = fromShop ?? scheme ?? "pds"
  return (
    <>
      <SchemeChooser scheme={active} />
      {active === "pds" ? children : <SchemeReport scheme={active} initialShop={shopId} />}
    </>
  )
}
