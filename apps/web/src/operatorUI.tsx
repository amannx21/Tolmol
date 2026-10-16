// #/my-outlet: the outlet's own dashboard, for the phone verified as its operator (a ration shop's dealer, a school's
// head teacher, a gram panchayat's employment assistant). Everything the outlet does on Tolmol in one place: reports
// waiting for an answer, answered reports with the reporter's verdict, the monthly board, the Fair badge, officials'
// actions. Everything is read from Arkiv, and every answer or board is sealed; the outlet cannot edit or hide reports.
import { useEffect, useState } from "preact/hooks"
import { dedupeReports, forScheme, latestFollowups, shopCorrections, shopFollowups, shopReports, shopResponses, validResponses, withdrawnKeys, type Followup, type Report, type Response, type Shop } from "tolmol-sdk"
import { ActionIcon } from "./ActionIcon"
import { device, reader, short } from "./arkiv"
import { outletKey, useFmt, useLang, type Key } from "./i18n"
import { OfficialActionsCard } from "./officialUI"
import { StockAndFairness } from "./stockUI"
import { ErrorBox, Loading, loadOutlets } from "./ui"
import { useDealers } from "./verified"

export function MyOutletPage() {
  const { t, lang } = useLang()
  const f = useFmt()
  const dealers = useDealers()
  const me = device().account.address.toLowerCase()
  const mine = dealers?.get(me)
  const [shop, setShop] = useState<Shop | null | undefined>(undefined)
  const [data, setData] = useState<{ counted: Report[]; answers: Map<string, Response[]>; followups: Map<string, Followup> } | null>(null)
  const [err, setErr] = useState<unknown>(null)
  useEffect(() => {
    if (!mine) return
    loadOutlets()
      .then((all) => setShop(all.find((s) => s.shopId === mine.shopId) ?? null))
      .catch(setErr)
  }, [mine?.shopId])
  useEffect(() => {
    if (!shop || !dealers) return
    Promise.all([shopReports(reader, shop.shopId), shopCorrections(reader, shop.shopId), shopResponses(reader, shop.shopId), shopFollowups(reader, shop.shopId)])
      .then(([reps, corr, rs, fs]) => {
        const own = forScheme(reps.items, shop.scheme)
        const counted = dedupeReports(own, withdrawnKeys(own, corr.items))
        setData({ counted, answers: validResponses(counted, rs.items, dealers), followups: latestFollowups(counted, fs.items) })
      })
      .catch(setErr)
  }, [shop?.shopId, dealers])

  if (!dealers) return <Loading />
  if (!mine)
    return (
      <section class="card">
        <h2>{t("myOutletTitle")}</h2>
        <p>{t("myOutletNone")}</p>
        <a class="button" href="#/test-cards?role=dealer">
          <ActionIcon name="shield" />
          {t("navGetVerified")}
        </a>
      </section>
    )
  if (err) return <ErrorBox error={err} />
  if (shop === undefined || (shop && !data)) return <Loading />
  if (!shop) return <p class="err">{t("notInRegistry")}</p>

  const waiting = data!.counted.filter((r) => r.shortfallG > 0 && !data!.answers.has(r.key.toLowerCase()))
  const answered = data!.counted.filter((r) => data!.answers.has(r.key.toLowerCase()))
  const row = (r: Report) => (
    <li>
      <a href={`#/r/${r.key}`}>
        {f.month(r.month)} · {t(r.item as Key)} · {f.amt(r.item, r.receivedG)} / {f.amt(r.item, r.entitledG)} · {short(r.key)}
      </a>
    </li>
  )
  return (
    <>
      <section class="card">
        <p class="small muted">{t(outletKey("roleDealerTitle", shop.scheme), { shop: shop.shopId })}</p>
        <h2>{lang === "hi" ? shop.labelHi : shop.labelEn}</h2>
        <p class="small">{t(outletKey("roleDealerBody", shop.scheme))}</p>
        <div class="statrow">
          <div>
            <div class="big">{waiting.length}</div>
            <div class="label">{t("myOutletWaiting")}</div>
          </div>
          <div>
            <div class="big">{answered.length}</div>
            <div class="label">{t("myOutletAnswered")}</div>
          </div>
          <div>
            <div class="big">{[...data!.followups.values()].filter((x) => x.status === "fixed").length}</div>
            <div class="label">{t("myOutletFixed")}</div>
          </div>
        </div>
        <a class="button secondary" href={`#/shop/${shop.shopId}`}>
          <ActionIcon name="shop" />
          {t("myOutletPublic")}
        </a>
      </section>
      <section class="card">
        <h3>{t("myOutletWaitingTitle")}</h3>
        {waiting.length ? <ul class="list">{waiting.map(row)}</ul> : <p class="muted">{t("myOutletNoneWaiting")}</p>}
        <p class="small muted">{t("myOutletAnswerHow")}</p>
      </section>
      {answered.length > 0 && (
        <section class="card">
          <h3>{t("myOutletAnsweredTitle")}</h3>
          <ul class="list">
            {answered.map((r) => {
              const fu = data!.followups.get(r.key.toLowerCase())
              return (
                <li>
                  <a href={`#/r/${r.key}`}>
                    {f.month(r.month)} · {short(r.key)}
                  </a>{" "}
                  · {data!.answers.get(r.key.toLowerCase())!.map((a) => t(`act_${a.action}` as Key)).join(", ")}{" "}
                  {fu && <span class={fu.status === "fixed" ? "tag ok-tag" : "tag warn"}>{t(fu.status === "fixed" ? "reporterSaysFixed" : "reporterSaysNotFixed")}</span>}
                </li>
              )
            })}
          </ul>
        </section>
      )}
      <StockAndFairness shop={shop} counted={data!.counted} />
      <OfficialActionsCard shop={shop} reports={data!.counted} />
    </>
  )
}
