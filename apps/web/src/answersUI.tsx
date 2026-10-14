import { ActionIcon } from "./ActionIcon"
// Shops answer, reporters confirm (community score card). Read straight from Arkiv; writes are sealed entities.
import { useEffect, useState } from "preact/hooks"
import {
  answerStats,
  followUpReport,
  latestFollowups,
  reportFollowups,
  reportResponses,
  respondToReport,
  shopFollowups,
  shopResponses,
  suggestedActions,
  validResponses,
  type Followup,
  type FollowupStatus,
  type Report,
  type Response,
  type ResponseAction,
} from "tolmol-sdk"
import { device, ensureGas, reader, short, writerForAddress } from "./arkiv"
import { useLang, type Key } from "./i18n"
import { useDealers } from "./verified"

const actKey = (a: ResponseAction) => `act_${a}` as Key

/** On a report page: the shop's answers, the dealer's answer buttons, and the reporter's "was it fixed?" buttons. */
export function ShopAnswer({ report, mine, big = false }: { report: Report; mine: boolean; big?: boolean }) {
  const { t } = useLang()
  const dealers = useDealers()
  const [data, setData] = useState<{ answers: Response[]; followup: Followup | undefined } | null>(null)
  const [pick, setPick] = useState<ResponseAction | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = async () => {
    if (!dealers) return
    const head = await reader.getBlockNumber({ cacheTime: 0 })
    const [rs, fs] = await Promise.all([reportResponses(reader, report.key, { atBlock: head }), reportFollowups(reader, report.key, { atBlock: head })])
    setData({
      answers: validResponses([report], rs.items, dealers).get(report.key.toLowerCase()) ?? [],
      followup: latestFollowups([report], fs.items).get(report.key.toLowerCase()),
    })
  }
  useEffect(() => {
    void load().catch(() => setData({ answers: [], followup: undefined }))
  }, [report.key, dealers])

  if (!data || !dealers) return null
  const me = device().account.address.toLowerCase()
  const iAmDealer = dealers.get(me)?.shopId === report.shopId

  const send = async (fn: () => Promise<unknown>, address: `0x${string}`, done: string) => {
    setBusy(true)
    setMsg(null)
    try {
      if (!(await ensureGas(address))) {
        setMsg({ ok: false, text: t("gasFailed") })
        return
      }
      await fn()
      await load()
      setPick(null)
      setMsg({ ok: true, text: done })
    } catch {
      setMsg({ ok: false, text: t("errGeneric") })
    } finally {
      setBusy(false)
    }
  }
  const answer = () => pick && send(() => respondToReport(reader, device().writer, report, pick, { synthetic: true }), device().account.address, t("answerSent"))
  const follow = (status: FollowupStatus) => {
    const w = writerForAddress(report.creator)
    if (w) void send(() => followUpReport(reader, w, report, status, { synthetic: true }), w.account.address, t(status === "fixed" ? "youSaidFixed" : "youSaidNotFixed"))
  }

  return (
    <section class={`card answers ${big ? "easy" : ""}`}>
      <h3>{t("shopAnswerTitle")}</h3>
      {data.answers.length === 0 ? (
        <p class="muted">{t("noShopAnswer")}</p>
      ) : (
        <ul class="list">
          {data.answers.map((a) => (
            <li class={a.action === "disputed" ? "warn-text" : ""}>
              🏪 {t(actKey(a.action))} <span class="small muted">· {short(a.creator)}</span>
            </li>
          ))}
        </ul>
      )}
      {data.followup && (
        <p class={data.followup.status === "fixed" ? "ok" : "warn-text"}>
          {mine ? t(data.followup.status === "fixed" ? "youSaidFixed" : "youSaidNotFixed") : t(data.followup.status === "fixed" ? "reporterSaysFixed" : "reporterSaysNotFixed")}
        </p>
      )}

      {mine && data.answers.length > 0 && (
        <div class="followup">
          <p class={big ? "lead" : ""}>{t("didShopFix")}</p>
          <div class="row wrap">
            <button class={big ? "big-action" : ""} disabled={busy} onClick={() => follow("fixed")}>
              {t("fixedYes")}
            </button>
            <button class={`secondary ${big ? "big-action" : ""}`} disabled={busy} onClick={() => follow("not_fixed")}>
              {t("fixedNo")}
            </button>
          </div>
        </div>
      )}

      {iAmDealer && !mine && (
        <div class="dealer-answer">
          <h4>{t("answerAsDealer")}</h4>
          <p class="small">{t("answerHelp")}</p>
          <div class="issue-grid">
            {suggestedActions(report.issues).map((a) => (
              <button class={`chip ${pick === a ? "selected" : ""}`} aria-pressed={pick === a} onClick={() => setPick(a)}>
                {t(actKey(a))}
              </button>
            ))}
          </div>
          <button onClick={answer} disabled={!pick || busy}>
            <ActionIcon name="send" />{t("sendAnswer")}
          </button>
        </div>
      )}
      {msg && <p class={msg.ok ? "ok" : "err"}>{msg.text}</p>}
    </section>
  )
}

/** On a shop page: answered / fixed (confirmed by reporters) / not fixed / disputed, the dealer, and a dealer's to-do list. */
export function ShopScoreCard({ shopId, counted }: { shopId: string; counted: Report[] }) {
  const { t } = useLang()
  const dealers = useDealers()
  const [data, setData] = useState<{ answers: Map<string, Response[]>; followups: Map<string, Followup> } | null>(null)
  useEffect(() => {
    if (!dealers) return
    let live = true
    Promise.all([shopResponses(reader, shopId), shopFollowups(reader, shopId)])
      .then(([rs, fs]) => live && setData({ answers: validResponses(counted, rs.items, dealers), followups: latestFollowups(counted, fs.items) }))
      .catch(() => live && setData({ answers: new Map(), followups: new Map() }))
    return () => {
      live = false
    }
  }, [shopId, dealers, counted.length])
  if (!data || !dealers) return null
  const s = answerStats(counted, data.answers, data.followups)
  const shopDealers = [...dealers.values()].filter((d) => d.shopId === shopId)
  const me = device().account.address.toLowerCase()
  const iAmDealer = dealers.get(me)?.shopId === shopId
  const waiting = counted.filter((r) => r.shortfallG > 0 && !data.answers.has(r.key.toLowerCase()))
  return (
    <section class="card score">
      <h3>{t("scoreTitle")}</h3>
      <p>{t("scoreLine", { a: s.answered, n: s.reports, f: s.fixed, nf: s.notFixed, d: s.disputed })}</p>
      <p class="small muted">{shopDealers.length ? t("dealerLine", { d: shopDealers.map((d) => short(d.device)).join(", ") }) : t("noDealer")}</p>
      <p class="small muted">{t("scoreHelp")}</p>
      {iAmDealer && (
        <div class="notice">
          <p>{t("youAreDealer", { n: waiting.length })}</p>
          <ul class="list">
            {waiting.slice(0, 20).map((r) => (
              <li>
                <a href={`#/r/${r.key}`}>
                  {r.month} · {t(r.item as Key)} · {short(r.key)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
