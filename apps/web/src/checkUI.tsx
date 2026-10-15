// "Check my shop": one box, one answer. Any outlet (ration shop, school, gram panchayat): the verdict is worked out in
// the browser from public Arkiv data with the same rule everyone uses (tolmol-sdk shopVerdict), from three queries.
import { useEffect, useState } from "preact/hooks"
import {
  addMonths,
  boardMissing,
  currentMonth,
  dedupeReports,
  forScheme,
  shopCorrections,
  shopReports,
  shopStats,
  shopStocks,
  shopVerdict,
  withdrawnKeys,
  type Scheme,
  type Shop,
  type ShopStats,
  type Verdict,
} from "tolmol-sdk"
import { ActionIcon } from "./ActionIcon"
import { reader } from "./arkiv"
import { IssueCounts } from "./extras"
import { useLang, type Key } from "./i18n"
import { ErrorBox, loadOutlets } from "./ui"

const ICON: Record<Verdict, string> = { red: "🟥", amber: "🟧", green: "🟩", grey: "⬜" }

export function CheckShop({ scheme }: { scheme?: Scheme } = {}) {
  const { t, lang } = useLang()
  const [outlets, setOutlets] = useState<Shop[]>([])
  const [q, setQ] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<unknown>(null)
  const [res, setRes] = useState<{ shop: Shop; stats: ShopStats | undefined; verdict: Verdict; noBoard: boolean } | null>(null)
  useEffect(() => {
    loadOutlets().then((all) => setOutlets(scheme ? all.filter((s) => s.scheme === scheme) : all), () => setOutlets([]))
  }, [scheme])
  const label = (s: Shop) => (lang === "hi" ? s.labelHi : s.labelEn)

  const check = async () => {
    const id = q.trim().toUpperCase()
    const shop = outlets.find((s) => s.shopId === id || label(s).toUpperCase() === id)
    setErr(null)
    setRes(null)
    if (!shop) return setErr(new Error(t("checkUnknown")))
    setBusy(true)
    try {
      const [reps, corr, boards] = await Promise.all([
        shopReports(reader, shop.shopId),
        shopCorrections(reader, shop.shopId),
        shop.scheme === "pds" ? shopStocks(reader, shop.shopId) : Promise.resolve({ items: [] }),
      ])
      const mine = forScheme(reps.items, shop.scheme)
      // The last two months: what a card holder needs to know before going to the shop this month.
      const recent = mine.filter((r) => r.month >= addMonths(currentMonth(), -1))
      const counted = dedupeReports(recent, withdrawnKeys(mine, corr.items))
      const stats = shopStats(counted, [])[0]
      const noBoard = shop.scheme === "pds" && counted.length > 0 && boardMissing(boards.items, currentMonth())
      setRes({ shop, stats, verdict: shopVerdict(stats, { noBoard }), noBoard })
    } catch (e) {
      setErr(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section class="card check-shop" aria-labelledby="check-title">
      <h2 id="check-title">{t(scheme === "mdm" ? "checkTitle_mdm" : scheme === "nrega" ? "checkTitle_nrega" : "checkTitle")}</h2>
      <p class="small">{t("checkHelp")}</p>
      <form
        class="row wrap"
        onSubmit={(e) => {
          e.preventDefault()
          void check()
        }}
      >
        <input class="mono" list="check-outlets" value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder={scheme === "mdm" ? "SYN-BR-5001" : scheme === "nrega" ? "SYN-BR-7001" : "SYN-BR-0042"} aria-label={t("checkPlaceholder")} />
        <datalist id="check-outlets">
          {outlets.map((s) => (
            <option value={s.shopId}>{label(s)}</option>
          ))}
        </datalist>
        <button type="submit" disabled={busy || !q.trim()}>
          <ActionIcon name="check" />
          {busy ? t("loading") : t("checkBtn")}
        </button>
      </form>
      {err !== null && <ErrorBox error={err} />}
      {res && (
        <div class={`verdict verdict-${res.verdict}`} role="status">
          <p class="verdict-line">
            <span aria-hidden="true">{ICON[res.verdict]}</span> <strong>{t(`verdict_${res.verdict}` as Key)}</strong>
          </p>
          <p>
            {label(res.shop)} <span class="mono small muted">{res.shop.shopId}</span>
          </p>
          {res.stats && (
            <p class="small">
              {t("checkLine", { pct: (res.stats.shortfallBp / 100).toFixed(1), n: res.stats.reports, d: res.stats.reporters })}
            </p>
          )}
          {res.stats && <IssueCounts counts={res.stats.issueCounts} labels scheme={res.shop.scheme} />}
          {res.noBoard && <p class="small notice">{t("checkNoBoard")}</p>}
          <p class="small muted">{t(`verdictHelp_${res.verdict}` as Key)}</p>
          <a class="button secondary" href={`#/shop/${res.shop.shopId}`}>
            <ActionIcon name="shop" />
            {t("checkOpen")}
          </a>
        </div>
      )}
    </section>
  )
}
