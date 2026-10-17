import type { ComponentChildren } from "preact"
import { useState } from "preact/hooks"
import { explorerAddressUrl, explorerEntityUrl, listOutlets, quotaError, type Shop } from "tolmol-sdk"
import { device, MIN_WRITE_WEI, reader, requestGas, short, useBalance } from "./arkiv"
import { outletKey, useLang } from "./i18n"
import { OperatorBanner, useOperator } from "./operatorBanner"
import { usePrefs } from "./prefs"
import { stopSpeaking } from "./speak"
import { PhoneVerification } from "./verified"
import type { Route } from "./router"
import { Mark } from "./Identity"
import { ActionIcon } from "./ActionIcon"
import { ReadInspector, SavedCopyBanner } from "./inspector"
import { trustedRegistry, usingCustomRegistry } from "./trust"
import { useWorkspace, WorkspaceBar, workspaceHref } from "./workspace"

export function Layout({ route, children }: { route: Route; children: ComponentChildren }) {
  const { t, toggle, lang } = useLang()
  const [prefs, setPrefs] = usePrefs()
  // Ration is the main workspace; in an add-on's workspace, Home, Dashboard and Report stay inside that add-on.
  const ws = useWorkspace(route)
  // A phone verified as an outlet's operator gets its own menu item (and the banner below the menu).
  const op = useOperator()
  const nav: [Route["name"], string, string][] = [
    ["home", workspaceHref(ws, "home"), t("navHome")],
    ["dashboard", workspaceHref(ws, "dashboard"), t("navDashboard")],
    ["me", "#/me", t("navMe")],
    ["testCards", "#/test-cards", t("navGetVerified")],
    ["about", "#/about", t("navAbout")],
  ]
  if (prefs.mode === "full") nav.splice(2, 0, ["verify", "#/verify", t("navVerify")])
  if (op) nav.splice(2, 0, ["myOutlet", "#/my-outlet", t(outletKey("navMyOutlet", op.scheme))])
  nav.push(["report", workspaceHref(ws, "report"), t("navReport")])
  return (
    <>
      <a class="skip-link" href="#main-content" onClick={(event) => {
        event.preventDefault()
        document.getElementById("main-content")?.focus()
      }}>{lang === "hi" ? "मुख्य सामग्री पर जाएँ" : "Skip to content"}</a>
      <header class="top">
        <a class="brand" href="#/">
          <span class="logo"><Mark /></span><span>{t("appName")}<small>{lang === "hi" ? "सबके लिए समान" : "Equal for all"}</small></span>
        </a>
        <div class="top-actions">
          <button
            class="lang"
            onClick={() => setPrefs({ mode: prefs.mode === "easy" ? "full" : "easy", chosen: true })}
            aria-label={`${t("switchMode")}: ${prefs.mode === "easy" ? t("modeFull") : t("modeEasy")}`}
          >
            {prefs.mode === "easy" ? t("modeFull") : t("modeEasy")}
          </button>
          <button class="lang" onClick={toggle} aria-label="Switch language / भाषा बदलें">
            {t("language")}
          </button>
          <button
            class="lang"
            onClick={() => setPrefs({ theme: prefs.theme === "dark" ? "light" : "dark" })}
            aria-label={prefs.theme === "dark" ? t("themeLight") : t("themeDark")}
            title={prefs.theme === "dark" ? t("themeLight") : t("themeDark")}
          >
            {prefs.theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
      </header>
      {prefs.mode === "easy" && (
        <div class="voicebar">
          <button
            class="voice"
            onClick={() => {
              if (prefs.voice) stopSpeaking()
              setPrefs({ voice: !prefs.voice })
            }}
          >
            {prefs.voice ? t("voiceOn") : t("voiceOff")}
          </button>
        </div>
      )}
      <nav class="tabs" aria-label="Main">
        {nav.map(([name, href, label]) => (
          <a class={name === "report" ? "nav-report" : undefined} href={href} aria-current={route.name === name || (name === "home" && route.name === "schemes") ? "page" : undefined}>
            <ActionIcon name={name === "home" ? "home" : name === "dashboard" ? "dashboard" : name === "verify" ? "check" : name === "about" ? "info" : name === "me" ? "id" : name === "testCards" ? "shield" : name === "myOutlet" ? "shop" : "report"} />{label}
          </a>
        ))}
      </nav>
      <OperatorBanner route={route} />
      <WorkspaceBar ws={ws} rationOnly={route.name === "home"} />
      <p class="banner" role="note">
        {t("synthetic")}
      </p>
      <SavedCopyBanner />
      {usingCustomRegistry() && (
        <p class="banner saved-copy" role="alert">
          {t("trustBanner", { reg: trustedRegistry().slice(0, 10) })} <a href="#/trust">{t("trustBannerLink")}</a>
        </p>
      )}
      <main id="main-content" tabIndex={-1} class={`page-${route.name} mode-${prefs.mode}`}>{children}</main>
      <footer class="foot">
        <a href="https://github.com/amannx21/Tolmol">{t("sourceCode")}</a> · <a href="https://github.com/amannx21/Tolmol/blob/main/arkiv/schema.md">{t("dataSchema")}</a> ·{" "}
        <span>{t("network")} · chain 7738577</span>
        {" · "}
        <a href="#/trust">{t("trustLink")}</a>
        {" · "}
        <a href="#/raw">{t("rawLink")}</a>
        {" · "}
        <a href="#/schemes">{t("addOnsLink")}</a>
        {" · "}
        <a href="#/my-outlet">{t("footOwners")}</a>
        {" · "}
        <a href="#/public">{t("pubLink")}</a>
        <ReadInspector />
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
    } else
      setState(
        r.error === "NO_RELAYER" ? t("noRelayer") : r.status === 429 ? t("gasLimit") : r.status === 409 ? t("gasNotNeeded") : r.status === 503 ? t("gasEmpty") : t("errGeneric"),
      )
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
      {!compact && <PhoneVerification />}
      {low && <p class="small">{t("needGas")}</p>}
      {low && (
        <div class="row">
          <button onClick={drip} disabled={state === "busy"}>
            <ActionIcon name="download" />{state === "busy" ? t("gettingGas") : t("getGas")}
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
  return <p class="muted loading" role="status"><span class="loading-dot" aria-hidden="true" />{t("loading")}</p>
}

/** No connection (or the request never left the phone): browsers word this differently, anywhere in the cause chain. */
function noConnection(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true
  for (let c: unknown = error, i = 0; c && i < 12; c = (c as { cause?: unknown }).cause, i++) {
    const o = c as { message?: string; details?: string }
    if (/Failed to fetch|NetworkError|Load failed|fetch failed|ERR_INTERNET_DISCONNECTED/i.test(`${o.message ?? ""} ${o.details ?? ""}`)) return true
  }
  return false
}

export function ErrorBox({ error }: { error: unknown }) {
  const { t } = useLang()
  if (noConnection(error)) {
    return (
      <p class="err" role="alert">
        {t("noConnection")}
      </p>
    )
  }
  const q = quotaError(error)
  if (q) {
    const mins = q.retryAfterSeconds ? Math.ceil(q.retryAfterSeconds / 60) : null
    return (
      <p class="err" role="alert">
        {t("quota")}
        {mins ? ` ${t("quotaWait")} ${mins} min.` : ""}
      </p>
    )
  }
  return (
    <p class="err" role="alert">
      {t("error")}: {String((error as Error)?.message ?? error).split("\n")[0]}
    </p>
  )
}

// --- Registry cache (Q1, trusted by creator). Loaded once per session.
// The registry lists every outlet: ration shops, schools and gram panchayats. Ration screens use loadShops (ration
// shops only), so they never offer a school as a ration shop; pages that serve any scheme use loadOutlets.
let outletsPromise: Promise<Shop[]> | undefined
export const loadOutlets = () =>
  (outletsPromise ??= listOutlets(reader, {}, { registry: trustedRegistry() }).then(
    (r) => r.items.sort((a, b) => (a.shopId < b.shopId ? -1 : 1)),
    (e: unknown) => {
      outletsPromise = undefined // a failed read (say, the read limit) is retried on the next page, not kept
      throw e
    },
  ))
export const loadShops = () => loadOutlets().then((all) => all.filter((s) => s.scheme === "pds"))

export const ShortfallBar = ({ bp }: { bp: number }) => (
  <span class="bar" aria-hidden="true">
    <span style={{ width: `${Math.min(100, bp / 100)}%`, background: bp >= 1500 ? "var(--bad)" : bp >= 500 ? "var(--warn)" : "var(--ok)" }} />
  </span>
)

/** Decorative seal appears only after the existing write flow confirms success. */
export function SuccessSeal() {
  return <svg class="success-seal" viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <circle cx="20" cy="20" r="18" fill="var(--soft)" />
    <circle class="seal-ring" cx="20" cy="20" r="16" stroke="currentColor" stroke-width="1.5" pathLength="1" />
    <path class="seal-check" d="m12 20 5 5 11-11" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" pathLength="1" />
  </svg>
}
