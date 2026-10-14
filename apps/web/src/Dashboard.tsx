import { useEffect, useMemo, useRef, useState } from "preact/hooks"
import {
  addMonths,
  currentMonth,
  dashboardReports,
  dashboardWitnesses,
  describeDashboardQueries,
  formatBp,
  monthToNum,
  shopStats,
  stateCorrections,
  validWitnesses,
  watchTolmol,
  withdrawnKeys,
  type Correction,
  type LiveStatus,
  type Report,
  type Witness,
} from "tolmol-sdk"
import { liveReader, reader } from "./arkiv"
import { STATE_NAMES, useFmt, useLang } from "./i18n"
import { go } from "./router"
import { IssueCounts } from "./extras"
import { ErrorBox, Loading, loadShops, ShortfallBar } from "./ui"

const STATES = ["BR", "UP", "JH"]

export function Dashboard({ initialState }: { initialState?: string }) {
  const { t, lang } = useLang()
  const f = useFmt()
  const [state, setState] = useState(initialState && STATES.includes(initialState) ? initialState : "BR")
  const toMonth = currentMonth()
  const [fromMonth, setFromMonth] = useState(addMonths(toMonth, -2))
  const [reports, setReports] = useState<Map<string, Report> | null>(null)
  const [witnesses, setWitnesses] = useState<Map<string, Witness>>(new Map())
  const [labels, setLabels] = useState<Map<string, string>>(new Map())
  const [status, setStatus] = useState<LiveStatus>("connecting")
  const [flash, setFlash] = useState<Set<string>>(new Set())
  const [err, setErr] = useState<unknown>(null)
  const [onlyConfirmed, setOnlyConfirmed] = useState(false)
  const [corrections, setCorrections] = useState<Correction[]>([])
  const scope = useRef({ state, from: monthToNum(fromMonth), to: monthToNum(toMonth) })
  scope.current = { state, from: monthToNum(fromMonth), to: monthToNum(toMonth) }

  // Initial load: two indexed queries (reports by state + month range, witnesses by state + month).
  useEffect(() => {
    setReports(null)
    setErr(null)
    ;(async () => {
      const head = await reader.getBlockNumber({ cacheTime: 0 })
      const months: string[] = []
      for (let m = fromMonth; monthToNum(m) <= monthToNum(toMonth); m = addMonths(m, 1)) months.push(m)
      const [rs, ws, shops, corr] = await Promise.all([
        dashboardReports(reader, { state, fromMonth, toMonth }, { atBlock: head }),
        dashboardWitnesses(reader, { state, months }, { atBlock: head }),
        loadShops(),
        stateCorrections(reader, state, { atBlock: head }),
      ])
      setLabels(new Map(shops.map((s) => [s.shopId, lang === "hi" ? s.labelHi : s.labelEn])))
      setCorrections(corr.items)
      setWitnesses(new Map(ws.items.map((w) => [w.key.toLowerCase(), w])))
      setReports(new Map(rs.items.map((r) => [r.key.toLowerCase(), r])))
    })().catch(setErr)
  }, [state, fromMonth, lang])

  // Live: pushed over WebSocket. New reports/witnesses in scope are merged and the ranking recomputes.
  useEffect(() => {
    const ping = (shopId: string) => {
      setFlash((f) => new Set(f).add(shopId))
      setTimeout(() => setFlash((f) => ((f = new Set(f)), f.delete(shopId), f)), 4000)
    }
    const inScope = (s: string, month: string) => s === scope.current.state && monthToNum(month) >= scope.current.from && monthToNum(month) <= scope.current.to
    const stop = watchTolmol(liveReader(), {
      onReport: (r) => {
        if (!inScope(r.state, r.month)) return
        setReports((m) => (m ? new Map(m).set(r.key.toLowerCase(), r) : m))
        ping(r.shopId)
      },
      onWitness: (w) => {
        if (!inScope(w.state, w.month)) return
        setWitnesses((m) => new Map(m).set(w.key.toLowerCase(), w))
        ping(w.shopId)
      },
      onExtended: (key, expiresAt) =>
        setReports((m) => {
          const r = m?.get(key.toLowerCase())
          return r && m ? new Map(m).set(key.toLowerCase(), { ...r, expiresAt }) : m
        }),
      onStatus: setStatus,
    })
    return stop
  }, [])

  // Trust-weighted view: optionally count only reports that at least one other device has confirmed.
  const ranked = useMemo(() => {
    if (!reports) return []
    const ws = [...witnesses.values()]
    const rs = [...reports.values()].filter((r) => !onlyConfirmed || validWitnesses(r, ws).length > 0)
    return shopStats(rs, ws, withdrawnKeys(rs, corrections))
  }, [reports, witnesses, onlyConfirmed, corrections])

  return (
    <>
      <section class="card">
        <div class="row between">
          <h2>{t("dashboardTitle")}</h2>
          <span class={`live ${status}`} role="status">
            ● {status === "live" ? t("live") : status === "reconnecting" ? t("reconnecting") : t("connecting")}
          </span>
        </div>
        <div class="row wrap">
          <select value={state} onChange={(e) => (setState(e.currentTarget.value), go(`#/dashboard?state=${e.currentTarget.value}`))} aria-label={t("state")}>
            {STATES.map((s) => (
              <option value={s}>{STATE_NAMES[s]?.[lang]}</option>
            ))}
          </select>
          <label class="inline">
            {t("from")}{" "}
            <select value={fromMonth} onChange={(e) => setFromMonth(e.currentTarget.value)}>
              {Array.from({ length: 12 }, (_, i) => addMonths(toMonth, -i)).map((m) => (
                <option value={m}>{f.month(m)}</option>
              ))}
            </select>
          </label>
          <span class="small muted">
            {t("to")} {f.month(toMonth)}
          </span>
        </div>
        <label class="inline check">
          <input type="checkbox" checked={onlyConfirmed} onChange={(e) => setOnlyConfirmed(e.currentTarget.checked)} /> {t("onlyConfirmed")}
        </label>
      </section>
      {err ? (
        <ErrorBox error={err} />
      ) : !reports ? (
        <Loading />
      ) : ranked.length === 0 ? (
        <p class="muted">{t("empty")}</p>
      ) : (
        <section class="card">
          <ol class="rank">
            {ranked.map((s) => (
              <li class={flash.has(s.shopId) ? "flash" : ""}>
                <a href={`#/shop/${s.shopId}`}>
                  <div class="row between">
                    <span>
                      <strong>{labels.get(s.shopId) ?? s.shopId}</strong> <span class="mono small muted">{s.shopId}</span>
                    </span>
                    <strong>{formatBp(s.shortfallBp)}</strong>
                  </div>
                  <ShortfallBar bp={s.shortfallBp} />
                  <IssueCounts counts={s.issueCounts} />
                  <div class="small muted">
                    {s.reports} {t("reports")} · {s.corroborated} {t("corroboratedReports")} · {f.kg(s.totalShortfallG)} {t("shortfall")} · {f.district(s.district)}
                  </div>
                </a>
              </li>
            ))}
          </ol>
        </section>
      )}
      <details class="card">
        <summary>{t("howComputed")}</summary>
        <p class="small">{t("howComputedHelp")}</p>
        <pre class="code">{describeDashboardQueries(state, fromMonth, toMonth).join("\n")}</pre>
      </details>
    </>
  )
}
