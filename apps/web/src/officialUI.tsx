// Officials act on the record: the shop page's "Official actions" card (with action buttons for a verified official of
// that district) and the dashboard's public "Needs official attention" list. All read straight from Arkiv.
import { useEffect, useState } from "preact/hooks"
import {
  OFFICIAL_ACTIONS,
  recordOfficialAction,
  shopOfficialActions,
  validOfficialActions,
  type Attention,
  type OfficialAction,
  type OfficialRecord,
} from "tolmol-sdk"
import { device, ensureGas, reader, short } from "./arkiv"
import { useFmt, useLang, type Key } from "./i18n"
import { loadShops } from "./ui"
import { useOfficials } from "./verified"

export const offKey = (a: OfficialAction) => `off_${a}` as Key

/** shop -> district from the registry (cached by loadShops). */
export function useShopDistricts(): Map<string, string> | null {
  const [m, setM] = useState<Map<string, string> | null>(null)
  useEffect(() => {
    loadShops().then((shops) => setM(new Map(shops.map((s) => [s.shopId, s.district]))), () => setM(new Map()))
  }, [])
  return m
}

export function OfficialActionsCard({ shop }: { shop: { shopId: string; state: string; district: string } }) {
  const { t } = useLang()
  const f = useFmt()
  const officials = useOfficials()
  const districts = useShopDistricts()
  const [list, setList] = useState<OfficialRecord[] | null>(null)
  const [pick, setPick] = useState<OfficialAction | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = async () => {
    if (!officials || !districts) return
    const r = await shopOfficialActions(reader, shop.shopId)
    setList(validOfficialActions(r.items, officials, districts).get(shop.shopId) ?? [])
  }
  useEffect(() => {
    void load().catch(() => setList([]))
  }, [shop.shopId, officials, districts])
  if (!list || !officials || !districts) return null

  const mine = officials.get(device().account.address.toLowerCase())
  const iAmOfficial = !!mine && districts.get(mine.shopId) === shop.district
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
              <strong>{t(offKey(a.action))}</strong> <span class="small muted">· #{a.createdAt.toString()} · {short(a.creator)}</span>
            </li>
          ))}
        </ul>
      )}
      <p class="small muted">{t("officialHelp")}</p>
      {iAmOfficial && (
        <div class="dealer-answer">
          <h4>{t("actAsOfficial", { district: f.district(shop.district) })}</h4>
          <div class="issue-grid">
            {OFFICIAL_ACTIONS.map((a) => (
              <button class={`chip ${pick === a ? "selected" : ""}`} aria-pressed={pick === a} onClick={() => setPick(a)}>
                {t(offKey(a))}
              </button>
            ))}
          </div>
          <p class="small muted">{t("officialActionLegal")}</p>
          <button onClick={record} disabled={!pick || busy}>
            {t("recordAction")}
          </button>
        </div>
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
