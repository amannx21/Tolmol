// Three separate workspaces on one site: Ration (the main one, exactly as designed), and two add-ons, School meals and
// MGNREGA wages. A slim bar under the menu keeps all three in view on every page, with ration first and largest, so
// people learn they can report the other two as well. Which workspace a page belongs to comes from the page itself.
import { useEffect, useState } from "preact/hooks"
import type { Scheme } from "tolmol-sdk"
import { useLang } from "./i18n"
import type { Route } from "./router"
import { loadOutlets } from "./ui"

export type Workspace = Scheme

/** The workspace of the current page: an add-on's own pages, an outlet of that scheme, otherwise ration. */
export function useWorkspace(route: Route): Workspace {
  const shopId = route.name === "shop" || route.name === "report" ? route.shopId : undefined
  const [fromShop, setFromShop] = useState<Workspace | null>(null)
  useEffect(() => {
    setFromShop(null)
    if (!shopId) return
    let live = true
    loadOutlets()
      .then((all) => live && setFromShop(all.find((s) => s.shopId === shopId)?.scheme ?? null))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [shopId])
  if (route.name === "schemes" && route.s) return route.s
  if ((route.name === "report" || route.name === "dashboard") && route.scheme && route.scheme !== "pds") return route.scheme
  return fromShop ?? "pds"
}

/** Where the menu's Home, Dashboard and Report go inside a workspace (ration: exactly as before). */
export function workspaceHref(ws: Workspace, page: "home" | "dashboard" | "report"): string {
  if (ws === "pds") return page === "home" ? "#/" : `#/${page}`
  return page === "home" ? `#/schemes/${ws}` : `#/${page}?scheme=${ws}`
}

export function WorkspaceBar({ ws }: { ws: Workspace }) {
  const { t } = useLang()
  return (
    <nav class="workspace-bar" aria-label={t("wsLabel")}>
      <a class={`ws ws-main ${ws === "pds" ? "active" : ""}`} href="#/" aria-current={ws === "pds" ? "page" : undefined}>
        <span aria-hidden="true">🌾</span> {t("wsRation")}
      </a>
      <span class="ws-also">{t("wsAlso")}</span>
      <a class={`ws ${ws === "mdm" ? "active" : ""}`} href="#/schemes/mdm" aria-current={ws === "mdm" ? "page" : undefined}>
        <span aria-hidden="true">🍲</span> {t("wsMdm")}
      </a>
      <a class={`ws ${ws === "nrega" ? "active" : ""}`} href="#/schemes/nrega" aria-current={ws === "nrega" ? "page" : undefined}>
        <span aria-hidden="true">⛏️</span> {t("wsNrega")}
      </a>
    </nav>
  )
}
