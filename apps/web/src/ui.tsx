import type { ComponentChildren } from "preact"
import { useState } from "preact/hooks"
import { explorerAddressUrl, explorerEntityUrl, listShops, type Shop } from "tolmol-sdk"
import { device, MIN_WRITE_WEI, reader, requestGas, short, useBalance } from "./arkiv"
import { useLang } from "./i18n"
import type { Route } from "./router"

export function Layout({ route, children }: { route: Route; children: ComponentChildren }) {
  const { t, toggle } = useLang()
  const nav: [Route["name"], string, string][] = [
    ["home", "#/", t("navHome")],
    ["report", "#/report", t("navReport")],
    ["dashboard", "#/dashboard", t("navDashboard")],
    ["about", "#/about", t("navAbout")],
  ]
  return (
    <>
      <header class="top">
        <a class="brand" href="#/">
          <span class="logo" aria-hidden="true">⚖</span> {t("appName")}
        </a>
        <button class="lang" onClick={toggle} aria-label="Switch language / भाषा बदलें">
          {t("language")}
        </button>
      </header>
      <nav class="tabs" aria-label="Main">
        {nav.map(([name, href, label]) => (
          <a href={href} aria-current={route.name === name ? "page" : undefined}>
            {label}
          </a>
        ))}
      </nav>
      <p class="banner" role="note">
        {t("synthetic")}
      </p>
      <main>{children}</main>
      <footer class="foot">
        <a href="https://github.com/amannx21/Tolmol">Source (MIT)</a> · <a href="https://github.com/amannx21/Tolmol/blob/main/arkiv/schema.md">Data schema</a> ·{" "}
        <span>Arkiv Tiramisu · chain 7738577</span>
      </footer>
    </>
  )
}

export function DeviceCard({ compact = false }: { compact?: boolean }) {
  const { t } = useLang()
  const { account } = device()
  const bal = useBalance(account.address)
  const [state, setState] = useState<"idle" | "busy" | "ok" | string>("idle")
  const low = bal.wei !== null && bal.wei < MIN_WRITE_WEI
  const drip = async () => {
    setState("busy")
    const r = await requestGas(account.address)
    if (r.ok) {
      setState("ok")
      // The transfer lands in the next block or two.
      setTimeout(() => void bal.refresh(), 4000)
      setTimeout(() => void bal.refresh(), 9000)
    } else setState(r.error ?? "error")
  }
  if (compact && !low) return null
  return (
    <section class={`card device ${low ? "warn" : ""}`} aria-live="polite">
      <div class="row">
        <div>
          <div class="label">{t("device")}</div>
          <a class="mono" href={explorerAddressUrl(account.address)} target="_blank" rel="noopener">
            {short(account.address)}
          </a>
        </div>
        <div>
          <div class="label">{t("balance")}</div>
          <span class="mono">{bal.glm} GLM</span>
        </div>
      </div>
      {!compact && <p class="small">{t("deviceHelp")}</p>}
      {low && <p class="small">{t("needGas")}</p>}
      {low && (
        <div class="row">
          <button onClick={drip} disabled={state === "busy"}>
            {state === "busy" ? t("gettingGas") : t("getGas")}
          </button>
          <a class="small" href="https://hub.arkiv.network/faucet" target="_blank" rel="noopener">
            {t("faucetFallback")}
          </a>
        </div>
      )}
      {state === "ok" && <p class="small ok">{t("gasOk")}</p>}
      {state !== "idle" && state !== "busy" && state !== "ok" && <p class="small err">{state}</p>}
    </section>
  )
}

export const Explorer = ({ k, label }: { k: string; label?: string }) => (
  <a class="mono small" href={explorerEntityUrl(k)} target="_blank" rel="noopener">
    {label ?? short(k)} ↗
  </a>
)

export function Loading() {
  const { t } = useLang()
  return <p class="muted">{t("loading")}</p>
}

export function ErrorBox({ error }: { error: unknown }) {
  const { t } = useLang()
  return (
    <p class="err" role="alert">
      {t("error")}: {String((error as Error)?.message ?? error).split("\n")[0]}
    </p>
  )
}

// --- Shop registry cache (Q1, trusted by creator). Loaded once per session.
let shopsPromise: Promise<Shop[]> | undefined
export const loadShops = () => (shopsPromise ??= listShops(reader, {}).then((r) => r.items.sort((a, b) => (a.shopId < b.shopId ? -1 : 1))))

export const ShortfallBar = ({ bp }: { bp: number }) => (
  <span class="bar" aria-hidden="true">
    <span style={{ width: `${Math.min(100, bp / 100)}%`, background: bp >= 1500 ? "var(--bad)" : bp >= 500 ? "var(--warn)" : "var(--ok)" }} />
  </span>
)
