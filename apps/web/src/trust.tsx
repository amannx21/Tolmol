// Whom this app trusts, shown and changeable. Every trust decision in Tolmol starts from ONE address: the registry,
// which names the outlets and the verifiers (and the verifiers name dealers, operators and officials). Here anyone can
// see that address, check it against the one published in the project's own GitHub repository (outside Arkiv and
// outside this site), see which verifiers it names and until when, and switch the app to a registry they trust more
// (`?registry=0x…` in the link). Everything else then follows from their choice, read from Arkiv by $creator.
import { useEffect, useState } from "preact/hooks"
import { DEFAULT_REGISTRY, explorerAddressUrl, listVerifiers, TEST_ISSUER, type Verifier } from "tolmol-sdk"
import { ActionIcon } from "./ActionIcon"
import { reader, short } from "./arkiv"
import { useLang } from "./i18n"

type Hex = `0x${string}`
const KEY = "tolmol.registry.v1"
const ADDR = /^0x[0-9a-fA-F]{40}$/
/** Where the project publishes its registry address, outside Arkiv and outside this site. */
export const ANCHOR_URL = "https://raw.githubusercontent.com/amannx21/Tolmol/main/arkiv/wallets.md"

function fromLink(): string | null {
  const q = new URLSearchParams(location.search)
  const h = new URLSearchParams(location.hash.split("?")[1] ?? "")
  return q.get("registry") ?? h.get("registry")
}
// A registry given in the link is remembered on this phone until reset.
;(() => {
  const r = fromLink()
  try {
    if (r && ADDR.test(r)) localStorage.setItem(KEY, r)
  } catch {
    /* storage blocked: the link still applies for this page load */
  }
})()

/** The registry this app trusts: the user's choice (link or settings) or the project's default. */
export function trustedRegistry(): Hex {
  const r = fromLink()
  if (r && ADDR.test(r)) return r as Hex
  try {
    const s = localStorage.getItem(KEY)
    if (s && ADDR.test(s)) return s as Hex
  } catch {
    /* default */
  }
  return DEFAULT_REGISTRY
}
export const usingCustomRegistry = () => trustedRegistry().toLowerCase() !== DEFAULT_REGISTRY.toLowerCase()
function setRegistry(r: string | null) {
  try {
    if (r) localStorage.setItem(KEY, r)
    else localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  location.href = `${location.origin}${location.pathname}#/trust`
  location.reload()
}

export function TrustPage() {
  const { t } = useLang()
  const reg = trustedRegistry()
  const [anchor, setAnchor] = useState<"checking" | "match" | "nomatch" | "unreachable">("checking")
  const [verifiers, setVerifiers] = useState<Verifier[] | null>(null)
  const [head, setHead] = useState<bigint | null>(null)
  const [input, setInput] = useState("")
  useEffect(() => {
    fetch(ANCHOR_URL, { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((txt) => setAnchor(txt.toLowerCase().includes(reg.toLowerCase()) ? "match" : "nomatch"))
      .catch(() => setAnchor("unreachable"))
    listVerifiers(reader, { registry: reg })
      .then((r) => (setVerifiers(r.items), setHead(r.atBlock)))
      .catch(() => setVerifiers([]))
  }, [reg])
  const days = (exp: bigint) => (head ? Math.max(0, Number((exp - head) / 43_200n)) : "…")
  return (
    <section class="card trust">
      <h2>{t("trustTitle")}</h2>
      <p class="small">{t("trustHelp")}</p>
      <h3>{t("trustRegistry")}</h3>
      <p>
        <a class="mono" href={explorerAddressUrl(reg)} target="_blank" rel="noopener">
          {reg}
        </a>{" "}
        {usingCustomRegistry() ? <span class="tag warn">{t("trustCustom")}</span> : <span class="tag">{t("trustDefault")}</span>}
      </p>
      <p class={anchor === "match" ? "ok" : anchor === "checking" ? "muted" : "notice"} role="status">
        {anchor === "match" ? `✓ ${t("trustAnchorMatch")}` : anchor === "nomatch" ? t("trustAnchorNoMatch") : anchor === "unreachable" ? t("trustAnchorUnreachable") : t("loading")}{" "}
        <a class="small" href={ANCHOR_URL.replace("raw.githubusercontent.com", "github.com").replace("/main/", "/blob/main/")} target="_blank" rel="noopener">
          arkiv/wallets.md ↗
        </a>
      </p>
      <h3>{t("trustVerifiers")}</h3>
      {verifiers === null ? (
        <p class="muted">{t("loading")}</p>
      ) : verifiers.length === 0 ? (
        <p class="muted">{t("trustNoVerifiers")}</p>
      ) : (
        <ul class="list">
          {verifiers.map((v) => (
            <li>
              <a class="mono" href={explorerAddressUrl(v.verifier)} target="_blank" rel="noopener">
                {short(v.verifier)}
              </a>{" "}
              · {t("trustLapses", { days: String(days(v.expiresAt)) })}
            </li>
          ))}
        </ul>
      )}
      <p class="small muted">{t("trustChain")}</p>
      <h3>{t("trustIssuer")}</h3>
      <p class="small">
        <span class="mono">{short(TEST_ISSUER)}</span> · {t("trustIssuerHelp")}
      </p>
      <h3>{t("trustChoose")}</h3>
      <p class="small">{t("trustChooseHelp")}</p>
      <div class="row wrap">
        <input class="mono" placeholder="0x…" value={input} onInput={(e) => setInput(e.currentTarget.value.trim())} aria-label={t("trustChoose")} size={44} />
        <button onClick={() => setRegistry(input)} disabled={!ADDR.test(input)}>
          <ActionIcon name="shield" />
          {t("trustUse")}
        </button>
        {usingCustomRegistry() && (
          <button class="secondary" onClick={() => setRegistry(null)}>
            <ActionIcon name="undo" />
            {t("trustReset")}
          </button>
        )}
      </div>
    </section>
  )
}
