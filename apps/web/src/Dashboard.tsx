import { useEffect, useMemo, useRef, useState } from "preact/hooks"
import {
  answerStats,
  needsAttention,
  stateOfficialActions,
  strongestAction,
  validOfficialActions,
  type OfficialRecord,
  dedupeReports,
  latestFollowups,
  stateFollowups,
  stateResponses,
  validResponses,
  type AnswerStats,
  type Followup,
  type Response,
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
  rapidReportKeys,
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
import { useDealers, useOfficials, useVerified } from "./verified"
import { AttentionList, offKey, useShopDistricts } from "./officialUI"

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
  const [hideRapid, setHideRapid] = useState(false)
  const [onlyVerified, setOnlyVerified] = useState(false)
  const verified = useVerified()
  const dealers = useDealers()
  const officials = useOfficials()
  const districts = useShopDistricts()
  const [offActs, setOffActs] = useState<OfficialRecord[] | null>(null)
  useEffect(() => {
    let live = true
    setOffActs(null)
    stateOfficialActions(reader, state)
      .then((r) => live && setOffActs(r.items))
      .catch(() => live && setOffActs([]))
    return () => {
      live = false
    }
  }, [state])
  const [answers, setAnswers] = useState<{ rs: Response[]; fs: Followup[] } | null>(null)
  useEffect(() => {
    let live = true
    setAnswers(null)
    Promise.all([stateResponses(reader, state), stateFollowups(reader, state)])
      .then(([rs, fs]) => live && setAnswers({ rs: rs.items, fs: fs.items }))
      .catch(() => live && setAnswers({ rs: [], fs: [] }))
    return () => {
      live = false
    }
  }, [state])
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
  // Public-data pattern: reports filed by 3+ phones within one minute at the same shop (see rapidGroups).
  const rapid = useMemo(() => {
    if (!reports) return new Set<string>()
    const all = [...reports.values()]
    return rapidReportKeys(all, withdrawnKeys(all, corrections))
  }, [reports, corrections])
  const rapidByShop = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of reports?.values() ?? []) if (rapid.has(r.key.toLowerCase())) m.set(r.shopId, (m.get(r.shopId) ?? 0) + 1)
    return m
  }, [reports, rapid])
  const ranked = useMemo(() => {
    if (!reports) return []
    const ws = [...witnesses.values()]
    const rs = [...reports.values()]
      .filter((r) => !onlyConfirmed || validWitnesses(r, ws).length > 0)
      .filter((r) => !hideRapid || !rapid.has(r.key.toLowerCase()))
      .filter((r) => !onlyVerified || !!verified?.has(r.creator.toLowerCase()))
    return shopStats(rs, ws, withdrawnKeys(rs, corrections))
  }, [reports, witnesses, onlyConfirmed, hideRapid, rapid, corrections, onlyVerified, verified])
  const verifiedByShop = useMemo(() => {
    const m = new Map<string, number>()
    if (!reports || !verified) return m
    const all = [...reports.values()]
    for (const r of dedupeReports(all, withdrawnKeys(all, corrections))) if (verified.has(r.creator.toLowerCase())) m.set(r.shopId, (m.get(r.shopId) ?? 0) + 1)
    return m
  }, [reports, verified, corrections])
  const answersByShop = useMemo(() => {
    const m = new Map<string, AnswerStats>()
    if (!reports || !answers || !dealers) return m
    const all = [...reports.values()]
    const counted = dedupeReports(all, withdrawnKeys(all, corrections))
    const valid = validResponses(counted, answers.rs, dealers)
    const fus = latestFollowups(counted, answers.fs)
    for (const shop of new Set(counted.map((r) => r.shopId))) m.set(shop, answerStats(counted.filter((r) => r.shopId === shop), valid, fus))
    return m
  }, [reports, answers, dealers, corrections])
  const actionsByShop = useMemo(() => (offActs && officials && districts ? validOfficialActions(offActs, officials, districts) : new Map<string, OfficialRecord[]>()), [offActs, officials, districts])
  const attention = useMemo(() => {
    if (!reports || !answers || !dealers || !verified) return null
    const all = [...reports.values()]
    return needsAttention(shopStats(all, [...witnesses.values()], withdrawnKeys(all, corrections)), answersByShop, verifiedByShop, actionsByShop)
  }, [reports, witnesses, corrections, answers, dealers, verified, answersByShop, verifiedByShop, actionsByShop])

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
        <label class="inline check">
          <input type="checkbox" checked={hideRapid} onChange={(e) => setHideRapid(e.currentTarget.checked)} /> {t("hideRapid")}
        </label>
        <label class="inline check">
          <input type="checkbox" checked={onlyVerified} onChange={(e) => setOnlyVerified(e.currentTarget.checked)} /> {t("onlyVerified")}
        </label>
      </section>
      {attention && <AttentionList items={attention} labels={labels} />}
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
                  {strongestAction(actionsByShop.get(s.shopId)) && <span class="tag warn">⚖ {t(offKey(strongestAction(actionsByShop.get(s.shopId))!.action))}</span>}
                  {(answersByShop.get(s.shopId)?.answered ?? 0) > 0 && (
                    <span class="tag">{t("answeredRow", { a: answersByShop.get(s.shopId)!.answered, n: answersByShop.get(s.shopId)!.reports, f: answersByShop.get(s.shopId)!.fixed })}</span>
                  )}
                  {(verifiedByShop.get(s.shopId) ?? 0) > 0 && <span class="tag ok-tag">{t("verifiedRow", { n: verifiedByShop.get(s.shopId) ?? 0 })}</span>}
                  {!hideRapid && (rapidByShop.get(s.shopId) ?? 0) > 0 && <span class="tag warn">{t("rapidBadge", { n: rapidByShop.get(s.shopId) ?? 0 })}</span>}
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
