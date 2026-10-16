import { ActionIcon } from "./ActionIcon"
// Officials act on the record: the shop page's "Official actions" card (with action buttons for a verified official of
// that district) and the dashboard's public "Needs official attention" list. All read straight from Arkiv.
import { useEffect, useState } from "preact/hooks"
import {
  activeDelegation,
  delegateInspector,
  INSPECTOR_ACTIONS,
  type Delegation,
  OFFICIAL_ACTIONS_FOR_SCHEME,
  recordOfficialAction,
  validOfficialActions,
  afterStats,
  isContradicted,
  CLEARING_ACTIONS,
  formatBp,
  type Report,
  type Attention,
  type OfficialAction,
  type OfficialRecord,
  type Scheme,
} from "tolmol-sdk"
import { shopDelegations, shopOfficialActions } from "./reads"
import { device, ensureGas, reader, short } from "./arkiv"
import { useFmt, useLang, type Key } from "./i18n"
import { loadOutlets } from "./ui"
import { useOfficials } from "./verified"
import { draftAppeal } from "./rti"
import { OfficialNotes } from "./notesUI"

export const offKey = (a: OfficialAction) => `off_${a}` as Key

/** shop -> district from the registry (cached by loadShops). */
export function useShopDistricts(): Map<string, string> | null {
  const [m, setM] = useState<Map<string, string> | null>(null)
  useEffect(() => {
    loadOutlets().then((shops) => setM(new Map(shops.map((s) => [s.shopId, s.district]))), () => setM(new Map()))
  }, [])
  return m
}

export function OfficialActionsCard({ shop, reports }: { shop: { shopId: string; state: string; district: string; scheme?: Scheme }; reports?: readonly Report[] }) {
  const { t, lang } = useLang()
  const [appeal, setAppeal] = useState<string | null>(null)
  const f = useFmt()
  const officials = useOfficials()
  const districts = useShopDistricts()
  const [list, setList] = useState<OfficialRecord[] | null>(null)
  const [pick, setPick] = useState<OfficialAction | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [dels, setDels] = useState<{ items: Delegation[]; head: bigint }>({ items: [], head: 0n })
  const [inspector, setInspector] = useState("")
  const [days, setDays] = useState("7")

  const load = async () => {
    if (!officials || !districts) return
    const [r, d] = await Promise.all([shopOfficialActions(reader, shop.shopId), shopDelegations(reader, shop.shopId)])
    setDels({ items: d.items, head: d.atBlock })
    setList(validOfficialActions(r.items, officials, districts, d.items).get(shop.shopId) ?? [])
  }
  useEffect(() => {
    void load().catch(() => setList([]))
  }, [shop.shopId, officials, districts])
  if (!list || !officials || !districts) return null

  const me = device().account.address.toLowerCase()
  const mine = officials.get(me)
  const iAmOfficial = !!mine && districts.get(mine.shopId) === shop.district
  // A live delegation to this phone from an official of this district: it may record inspection findings here.
  const myDelegation = activeDelegation(dels.items, me, shop.shopId, dels.head)
  const iAmInspector = !iAmOfficial && !!myDelegation && districts.get(officials.get(myDelegation.creator.toLowerCase())?.shopId ?? "") === shop.district
  const delegate = async () => {
    setBusy(true)
    setMsg(null)
    try {
      if (!(await ensureGas())) return setMsg({ ok: false, text: t("gasFailed") })
      await delegateInspector(reader, device().writer, shop, inspector, Number(days), { synthetic: true })
      await load()
      setInspector("")
      setMsg({ ok: true, text: t("delegated") })
    } catch {
      setMsg({ ok: false, text: t("errGeneric") })
    } finally {
      setBusy(false)
    }
  }
  const record = async () => {
    if (!pick) return
    setBusy(true)
    setMsg(null)
    try {
      if (!(await ensureGas())) {
        setMsg({ ok: false, text: t("gasFailed") })
        return
      }
      await recordOfficialAction(reader, device().writer, shop, pick, { synthetic: true })
      await load()
      setPick(null)
      setMsg({ ok: true, text: t("actionRecorded") })
    } catch {
      setMsg({ ok: false, text: t("errGeneric") })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section class="card official">
      <h3>⚖ {t("officialTitle")}</h3>
      {list.length === 0 ? (
        <p class="muted">{t("noOfficialAction")}</p>
      ) : (
        <ul class="list">
          {list.map((a) => (
            <li>
              <strong>{t(offKey(a.action))}</strong> <span class="small muted">· #{a.createdAt.toString()} · {short(a.creator)}{a.via ? ` · ${t("byInspector", { official: short(a.via) })}` : ""}</span>
              {reports && CLEARING_ACTIONS.includes(a.action) && (() => {
                // What people reported here after this finding: a "no issue" that later reports contradict is flagged.
                const s = afterStats(reports, shop.shopId, a.createdAt)
                const bad = isContradicted(a, s)
                return (
                  <>
                    <br />
                    <span class="small">{t("trackAfter", { n: s.reports, p: s.reporters, pct: formatBp(s.shortfallBp) })}</span>{" "}
                    {bad && <span class="tag warn">{t("trackContradicted")}</span>}{" "}
                    <button class="secondary small-btn" onClick={() => setAppeal(draftAppeal({ shop, finding: a, after: s, reports, pageUrl: `${location.origin}${location.pathname}#/shop/${shop.shopId}` }, lang))}>
                      {t("appealBtn")}
                    </button>
                  </>
                )
              })()}
            </li>
          ))}
        </ul>
      )}
      {appeal && (
        <>
          <p class="small">{t("appealHelp")}</p>
          <textarea class="rti" readOnly rows={14} value={appeal} aria-label={t("appealBtn")} />
        </>
      )}
      <p class="small muted">
        {t("officialHelp")} <a href={`#/track?state=${shop.state}`}>{t("trackLink")} →</a>
      </p>
      {iAmOfficial && <OfficialNotes shop={shop} reports={reports} />}
      {iAmOfficial && (
        <div class="dealer-answer">
          <h4>{t("actAsOfficial", { district: f.district(shop.district) })}</h4>
          <div class="issue-grid">
            {OFFICIAL_ACTIONS_FOR_SCHEME[shop.scheme ?? "pds"].map((a) => (
              <button class={`chip ${pick === a ? "selected" : ""}`} aria-pressed={pick === a} onClick={() => setPick(a)}>
                {t(offKey(a))}
              </button>
            ))}
          </div>
          <p class="small muted">{t("officialActionLegal")}</p>
          <button onClick={record} disabled={!pick || busy}>
            <ActionIcon name="save" />{t("recordAction")}
          </button>
          <h4>{t("delegateTitle")}</h4>
          <p class="small muted">{t("delegateHelp")}</p>
          <div class="row wrap">
            <input class="mono" placeholder="0x… (inspector's phone ID)" value={inspector} onInput={(e) => setInspector(e.currentTarget.value.trim())} size={44} aria-label={t("delegateTitle")} />
            <label class="inline">
              {t("delegateDays")} <input inputMode="numeric" size={3} value={days} onInput={(e) => setDays(e.currentTarget.value.trim())} />
            </label>
            <button class="secondary" onClick={delegate} disabled={busy || !/^0x[0-9a-fA-F]{40}$/.test(inspector) || !(Number(days) >= 1 && Number(days) <= 30)}>
              <ActionIcon name="shield" />
              {t("delegateBtn")}
            </button>
          </div>
        </div>
      )}
      {iAmInspector && myDelegation && (
        <div class="dealer-answer">
          <h4>{t("actAsInspector", { official: short(myDelegation.creator), days: String(Math.max(0, Number((myDelegation.untilBlock - dels.head) / 43_200n))) })}</h4>
          <div class="issue-grid">
            {INSPECTOR_ACTIONS.map((a) => (
              <button class={`chip ${pick === a ? "selected" : ""}`} aria-pressed={pick === a} onClick={() => setPick(a)}>
                {t(offKey(a))}
              </button>
            ))}
          </div>
          <button onClick={record} disabled={!pick || busy}>
            <ActionIcon name="save" />{t("recordAction")}
          </button>
        </div>
      )}
      {dels.items.length > 0 && (
        <details class="small">
          <summary>{t("delegationsList", { n: dels.items.length })}</summary>
          <ul class="list">
            {dels.items.map((d) => (
              <li>
                {t("delegationLine", { inspector: short(d.inspector), official: short(d.creator) })} {d.untilBlock >= dels.head ? t("delegationLive") : t("delegationEnded")}
              </li>
            ))}
          </ul>
        </details>
      )}
      {msg && <p class={msg.ok ? "ok" : "err"}>{msg.text}</p>}
    </section>
  )
}

/** The public list on the dashboard: which shops need official attention, why, and what has been done. */
export function AttentionList({ items, labels }: { items: Attention[]; labels: Map<string, string> }) {
  const { t } = useLang()
  const f = useFmt()
  return (
    <details class="card attention" open={items.length > 0}>
      <summary>
        ⚖ {t("attentionTitle")} ({items.length})
      </summary>
      <p class="small muted">{t("attentionHelp")}</p>
      {items.length === 0 ? (
        <p class="muted">{t("attentionNone")}</p>
      ) : (
        <ol class="rank">
          {items.map((x) => (
            <li>
              <a href={`#/shop/${x.shopId}`}>
                <strong>{labels.get(x.shopId) ?? x.shopId}</strong> <span class="mono small muted">{x.shopId}</span> · {f.district(x.district)}
                <div>
                  {x.reasons.map((r) => (
                    <span class={`tag ${r === "verified" || r === "confirmed" ? "" : "warn"}`}>{t(`reason_${r}` as Key)}</span>
                  ))}
                </div>
                <div class="small">{x.latest ? t("latestAction", { a: t(offKey(x.latest.action)) }) : t("noActionYet")}</div>
              </a>
            </li>
          ))}
        </ol>
      )}
    </details>
  )
}
