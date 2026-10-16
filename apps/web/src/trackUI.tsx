// #/track?state=BR: who checks the checkers. Every finding a verified official or a delegated inspector recorded in a
// state, set against what people reported at that outlet afterwards (tolmol-sdk trackRecords). Recomputed here from
// public entities; a corrupt "no issue found" stays on the record next to the reports that contradict it.
import { useEffect, useState } from "preact/hooks"
import {
  addMonths,
  currentMonth,
  explorerAddressUrl,
  formatBp,
  trackRecords,
  validOfficialActions,
  type TrackRecord,
} from "tolmol-sdk"
import { dashboardReports, stateDelegations, stateOfficialActions } from "./reads"
import { reader, short } from "./arkiv"
import { STATE_NAMES, useFmt, useLang } from "./i18n"
import { offKey, useShopDistricts } from "./officialUI"
import { ErrorBox, Loading } from "./ui"
import { useOfficials } from "./verified"

const STATES = ["BR", "UP", "JH"]

export function TrackPage({ state: initial }: { state?: string }) {
  const { t, lang } = useLang()
  const f = useFmt()
  const officials = useOfficials()
  const districts = useShopDistricts()
  const state = initial && STATES.includes(initial) ? initial : "BR"
  const [recs, setRecs] = useState<TrackRecord[] | null>(null)
  const [err, setErr] = useState<unknown>(null)
  useEffect(() => {
    if (!officials || !districts) return
    setRecs(null)
    const to = currentMonth()
    Promise.all([stateOfficialActions(reader, state), stateDelegations(reader, state), dashboardReports(reader, { state, fromMonth: addMonths(to, -11), toMonth: to })])
      .then(([acts, dels, reps]) => setRecs(trackRecords(validOfficialActions(acts.items, officials, districts, dels.items), reps.items)))
      .catch(setErr)
  }, [state, officials, districts])

  const role = (signer: string) => {
    const o = officials?.get(signer.toLowerCase())
    const d = o ? districts?.get(o.shopId) : undefined
    return o && d ? t("trackOfficial", { district: f.district(d) }) : t("trackInspector")
  }
  return (
    <section class="card">
      <h2>{t("trackTitle")}</h2>
      <p class="small">{t("trackHelp")}</p>
      <p class="row wrap">
        {STATES.map((s) => (
          <a class={`chip ${s === state ? "selected" : ""}`} href={`#/track?state=${s}`} aria-current={s === state ? "page" : undefined}>
            {STATE_NAMES[s]?.[lang] ?? s}
          </a>
        ))}
      </p>
      {err ? (
        <ErrorBox error={err} />
      ) : !recs ? (
        <Loading />
      ) : recs.length === 0 ? (
        <p class="muted">{t("trackNone")}</p>
      ) : (
        recs.map((r) => (
          <article class={`track-card ${r.contradicted ? "flagged" : ""}`}>
            <h3>
              {role(r.signer)} ·{" "}
              <a class="mono" href={explorerAddressUrl(r.signer)} target="_blank" rel="noopener">
                {short(r.signer)} ↗
              </a>
            </h3>
            <p class="small">
              {t("trackCounts", { n: r.findings.length, c: r.clearing, x: r.contradicted })}
            </p>
            <ul class="list">
              {r.findings.map((x) => (
                <li>
                  <strong>{t(offKey(x.action.action))}</strong> · <a href={`#/shop/${x.action.shopId}`}>{x.action.shopId}</a>{" "}
                  <span class="small muted">
                    · #{x.action.createdAt.toString()}
                    {x.action.via && x.action.via.toLowerCase() !== r.signer.toLowerCase() ? ` · ${t("byInspector", { official: short(x.action.via) })}` : ""}
                  </span>
                  <br />
                  <span class="small">{t("trackAfter", { n: x.after.reports, p: x.after.reporters, pct: formatBp(x.after.shortfallBp) })}</span>{" "}
                  {x.contradicted && <span class="tag warn">{t("trackContradicted")}</span>}
                </li>
              ))}
            </ul>
          </article>
        ))
      )}
    </section>
  )
}
