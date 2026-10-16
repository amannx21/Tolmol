import { ActionIcon } from "./ActionIcon"
import { useEffect, useMemo, useState } from "preact/hooks"
import qrcode from "qrcode-generator"
import {
  daysLeft,
  dedupeReports,
  evidenceRows,
  explorerAddressUrl,
  forScheme,
  formatBp,
  describeShopQueries,
  shopCorrections,
  shopReports,
  shopStats,
  shopWitnesses,
  toCsv,
  toJson,
  validWitnesses,
  withdrawnKeys,
  type Report,
  type Shop,
  type Witness,
} from "tolmol-sdk"
import { reader, short } from "./arkiv"
import { outletKey, STATE_NAMES, useFmt, useLang } from "./i18n"
import { go } from "./router"
import { IssueCounts, PatternsCard } from "./extras"
import { ShopScoreCard } from "./answersUI"
import { OfficialActionsCard } from "./officialUI"
import { draftComplaint, draftRti, type RtiInput } from "./rti"
import { ErrorBox, Explorer, Loading, loadOutlets, ShortfallBar } from "./ui"
import { useVerified, VerifiedBadge } from "./verified"
import { StockAndFairness } from "./stockUI"

/** A QR code (inline SVG) for this shop's public page, to print and stick up near the shop. */
function ShopQr({ url }: { url: string }) {
  const svg = useMemo(() => {
    const qr = qrcode(0, "M")
    qr.addData(url)
    qr.make()
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true })
  }, [url])
  return <div class="qr" role="img" aria-label={url} dangerouslySetInnerHTML={{ __html: svg }} />
}

type Data = { shop: Shop | undefined; reports: Report[]; witnesses: Witness[]; withdrawn: Set<string>; atBlock: bigint; head: bigint }

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = Object.assign(document.createElement("a"), { href: url, download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function ShopPage({ shopId, month, atBlock, letter }: { shopId: string; month?: string; atBlock?: string; letter?: "rti" | "complaint" }) {
  const verified = useVerified()
  const { t, lang } = useLang()
  const f = useFmt()
  const [rtiText, setRtiText] = useState<string | null>(null)
  const [data, setData] = useState<Data | null>(null)
  const [err, setErr] = useState<unknown>(null)
  const [blockInput, setBlockInput] = useState(atBlock ?? "")

  useEffect(() => {
    setData(null)
    setErr(null)
    ;(async () => {
      const head = await reader.getBlockNumber({ cacheTime: 0 })
      const at = atBlock && /^\d+$/.test(atBlock) && BigInt(atBlock) <= head ? BigInt(atBlock) : head
      const [shops, reps, wits, corr] = await Promise.all([
        loadOutlets(),
        shopReports(reader, shopId, month, { atBlock: at }),
        shopWitnesses(reader, shopId, month, { atBlock: at }),
        shopCorrections(reader, shopId, month, { atBlock: at }),
      ])
      const shop = shops.find((s) => s.shopId === shopId)
      // An outlet counts only reports of its own scheme (a school counts meal reports, never grain).
      const reports = forScheme(reps.items, shop?.scheme ?? "pds")
      setData({ shop, reports, witnesses: wits.items, withdrawn: withdrawnKeys(reports, corr.items), atBlock: at, head })
    })().catch(setErr)
  }, [shopId, month, atBlock])

  if (err) return <ErrorBox error={err} />
  if (!data) return <Loading />

  const kept = dedupeReports(data.reports, data.withdrawn)
  const keptKeys = new Set(kept.map((r) => r.key.toLowerCase()))
  const stats = shopStats(data.reports, data.witnesses, data.withdrawn)[0]
  const byMonth = new Map<string, { e: number; s: number; n: number }>()
  for (const r of kept) {
    const m = byMonth.get(r.month) ?? { e: 0, s: 0, n: 0 }
    m.e += r.entitledG
    m.s += r.shortfallG
    m.n++
    byMonth.set(r.month, m)
  }
  const months = [...byMonth.keys()].sort()
  const sorted = [...data.reports].sort((a, b) => (a.createdAt > b.createdAt ? -1 : a.createdAt < b.createdAt ? 1 : 0))
  const historic = data.atBlock !== data.head
  const q = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    const all = { month, block: atBlock, ...extra }
    for (const [k, v] of Object.entries(all)) if (v) p.set(k, v)
    const s = p.toString()
    return `#/shop/${shopId}${s ? `?${s}` : ""}`
  }

  const letterInput = (): RtiInput => ({
    shop: data.shop,
    shopId,
    months: month ? [month] : [...new Set(kept.map((r) => r.month))].sort(),
    reports: data.reports,
    witnesses: data.witnesses,
    withdrawn: data.withdrawn,
    atBlock: data.atBlock,
    pageUrl: `${location.origin}${location.pathname}#/shop/${shopId}${month ? `?month=${month}` : ""}`,
  })
  if (letter && rtiText === null) {
    // Opened from "What you can do now": draft the requested letter straight away.
    setTimeout(() => {
      setRtiText(letter === "complaint" ? draftComplaint(letterInput(), lang) : draftRti(letterInput(), lang))
      document.getElementById("letters")?.scrollIntoView({ behavior: "smooth" })
    }, 0)
  }

  const exportAs = (fmt: "csv" | "json") => {
    const rows = evidenceRows(data.reports, data.witnesses, data.atBlock, data.withdrawn)
    const base = `tolmol-${shopId}-${month ?? "all"}-block${data.atBlock}`
    if (fmt === "csv") download(`${base}.csv`, toCsv(rows), "text/csv")
    else
      download(
        `${base}.json`,
        toJson(rows, {
          note: "SYNTHETIC demo data. Each row can be re-checked on the Arkiv Tiramisu explorer by entity key.",
          network: "Arkiv Tiramisu testnet, chain 7738577",
          shop_id: shopId,
          month: month ?? "all",
          read_at_block: data.atBlock.toString(),
          exported_at: new Date().toISOString(),
        }),
        "application/json",
      )
  }

  return (
    <>
      <section class="card">
        <h2>
          {data.shop ? (lang === "hi" ? data.shop.labelHi : data.shop.labelEn) : shopId}
        </h2>
        <p class="small muted">
          <span class="mono">{shopId}</span>
          {data.shop && ` · ${f.district(data.shop.district)} · ${STATE_NAMES[data.shop.state]?.[lang] ?? data.shop.state}`}
          {!data.shop && ` · ${t("notInRegistry")}`}
        </p>
        {stats ? (
          <div class="statrow">
            <div>
              <div class="big">{formatBp(stats.shortfallBp)}</div>
              <div class="label">{t("shortfall")}</div>
            </div>
            <div>
              <div class="big">{stats.reports}</div>
              <div class="label">{t("reports")}</div>
            </div>
            <div>
              <div class="big">{stats.corroborated}</div>
              <div class="label">{t("corroboratedReports")}</div>
            </div>
          </div>
        ) : (
          <p class="muted">{t("empty")}</p>
        )}
        {stats && verified && <p class="small">{t("verifiedCount", { n: kept.filter((r) => verified.has(r.creator.toLowerCase())).length, total: kept.length })}</p>}
        {stats && <IssueCounts counts={stats.issueCounts} labels scheme={data.shop?.scheme ?? "pds"} />}
        <div class="row wrap shop-primary-actions">
          <select value={month ?? ""} onChange={(e) => go(q({ month: e.currentTarget.value || undefined }))} aria-label={t("month")}>
            <option value="">{t("allMonths")}</option>
            {[...new Set(data.reports.map((r) => r.month))].sort().reverse().map((m) => (
              <option value={m}>{f.month(m)}</option>
            ))}
          </select>
          <a class="button" href={`#/report?shop=${shopId}`}>
            <ActionIcon name="report" />{t("ctaReport")}
          </a>
        </div>
      </section>

      {data.shop && !historic && <StockAndFairness shop={data.shop} counted={kept} month={month} />}

      {months.length > 1 && (
        <section class="card">
          <h3>{t("timeline")}</h3>
          <ul class="timeline">
            {months.map((m) => {
              const v = byMonth.get(m)!
              const bp = Math.floor((v.s * 10_000) / v.e)
              return (
                <li>
                  <span>{f.month(m)}</span> <ShortfallBar bp={bp} /> <strong>{formatBp(bp)}</strong> <span class="small muted">({v.n})</span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section class="card">
        <h3>{t("reports")}</h3>
        <table class="tbl">
          <thead>
            <tr>
              <th>{t("month")}</th>
              <th>{t("item")}</th>
              <th>{t("shortfall")}</th>
              <th>{t("witnesses")}</th>
              <th>{t("reporter")}</th>
              <th>{t("expires")}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const w = validWitnesses(r, data.witnesses).length
              const counted = keptKeys.has(r.key.toLowerCase())
              return (
                <tr class={counted ? "" : "dim"}>
                  <td>{f.month(r.month)}</td>
                  <td>{t(r.item)}</td>
                  <td>
                    <a href={`#/r/${r.key}`}>
                      {f.amt(r.item, r.shortfallG)} · {formatBp(r.shortfallBp)}
                    </a>
                    {data.withdrawn.has(r.key.toLowerCase()) ? <span class="tag">{t("withdrawn")}</span> : !counted && <span class="tag">{t("duplicateIgnored")}</span>}
                  </td>
                  <td>{w}</td>
                  <td>
                    <a class="mono small" href={explorerAddressUrl(r.creator)} target="_blank" rel="noopener">
                      {short(r.creator)}
                    </a>{" "}
                    <VerifiedBadge a={verified?.get(r.creator.toLowerCase())} />
                  </td>
                  <td class="small">
                    {daysLeft(r.expiresAt, data.atBlock)} {t("days")} · <Explorer k={r.key} label="↗" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section class="card">
        <h3>{t("export")}</h3>
        <div class="row wrap">
          <button class="secondary" onClick={() => exportAs("csv")}>
            <ActionIcon name="download" />CSV
          </button>
          <button class="secondary" onClick={() => exportAs("json")}>
            <ActionIcon name="download" />JSON
          </button>
        </div>
        <form
          class="row wrap"
          onSubmit={(e) => {
            e.preventDefault()
            go(q({ block: blockInput.trim() || undefined }))
          }}
        >
          <label class="inline">
            {t("asOfBlock")}{" "}
            <input class="mono" inputMode="numeric" value={blockInput} placeholder={data.head.toString()} onInput={(e) => setBlockInput(e.currentTarget.value)} />
          </label>
          <button class="secondary" type="submit">
            <ActionIcon name="check" />{t("apply")}
          </button>
          {historic && (
            <a href={q({ block: undefined })} onClick={() => setBlockInput("")}>
              {t("asOfNow")}
            </a>
          )}
        </form>
        <p class="small muted mono">
          {t("readAtBlock")} {data.atBlock.toString()}
          {historic && ` (${t("headBlock")} ${data.head.toString()})`}
        </p>
      </section>

      <section class="card" id="letters">
        <h3>{t("rtiTitle")}</h3>
        <p class="small">{t("rtiHelp")}</p>
        <div class="row wrap">
          <button class="secondary" onClick={() => setRtiText(draftRti(letterInput(), lang))}>
            <ActionIcon name="letter" />{t("rtiDraft")}
          </button>
          <button class="secondary" onClick={() => setRtiText(draftComplaint(letterInput(), lang))}>
            <ActionIcon name="letter" />{t("draftComplaint")}
          </button>
          {rtiText && (
            <button class="secondary" onClick={() => download(`tolmol-letter-${shopId}-${month ?? "all"}-${lang}.txt`, rtiText, "text/plain;charset=utf-8")}>
              <ActionIcon name="download" />{t("rtiDownload")}
            </button>
          )}
        </div>
        {rtiText && <textarea class="rti" readOnly rows={16} value={rtiText} aria-label={t("rtiTitle")} />}
      </section>

      <ShopScoreCard shopId={shopId} counted={kept} scheme={data.shop?.scheme} />
      {data.shop && <OfficialActionsCard shop={data.shop} reports={data.reports} />}
      <PatternsCard reports={data.reports} witnesses={data.witnesses} withdrawn={data.withdrawn} />
      <details class="card">
        <summary>{t("howComputed")}</summary>
        <p class="small">{t("howComputedHelp")}</p>
        <pre class="code">{describeShopQueries(shopId, month).join("\n")}</pre>
        <p class="small mono">atBlock = {data.atBlock.toString()}</p>
      </details>

      <section class="card">
        <h3>{t(outletKey("qrTitle", data.shop?.scheme))}</h3>
        <p class="small">{t("qrHelp")}</p>
        <ShopQr url={`${location.origin}${location.pathname}#/report?shop=${shopId}`} />
        <button class="secondary" onClick={() => window.print()}>
          <ActionIcon name="print" />{t("print")}
        </button>
      </section>
    </>
  )
}
