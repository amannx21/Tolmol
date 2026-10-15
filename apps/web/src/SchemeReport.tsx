// Reporting for the other schemes on the same ledger: school meals (PM POSHAN) at a school, and MGNREGA wages at a
// gram panchayat. Same evidence model and the same Arkiv writes as a ration report (sealed, confirmable, answerable);
// only the outlet, the unit (days or rupees) and the questions change. Ration reports keep their own Easy and Full flows.
import { useEffect, useState } from "preact/hooks"
import {
  addMonths,
  currentMonth,
  DuplicateError,
  ITEM_INFO,
  REPORT_LIFETIME_CHOICES,
  SCHEME_ISSUE_GROUPS,
  SCHEME_ISSUES,
  type Scheme,
  type Shop,
} from "tolmol-sdk"
import { ActionIcon } from "./ActionIcon"
import { fileReport, GasError, SeparateIdError } from "./arkiv"
import { IssueList, PublicPreview, QueuedNote, SchemeIssuePicker } from "./extras"
import { useFmt, useLang, type Key } from "./i18n"
import { getPrefs } from "./prefs"
import { enqueueReport, getSendLater, isOffline } from "./queue"
import { ErrorBox, Loading, loadOutlets } from "./ui"

type Other = Exclude<Scheme, "pds">
const ITEM: Record<Other, "meal_days" | "wage_inr"> = { mdm: "meal_days", nrega: "wage_inr" }
/** Issues after which the person may face retaliation: a separate ID is switched on for them by default. */
export const SENSITIVE: Record<Other, number> = {
  mdm: SCHEME_ISSUES.mdm.money_asked! | SCHEME_ISSUES.mdm.seated_apart!,
  nrega: SCHEME_ISSUES.nrega.job_card_kept! | SCHEME_ISSUES.nrega.bribe_asked! | SCHEME_ISSUES.nrega.fake_names!,
}

const whole = (v: string) => (/^\d{1,6}$/.test(v.trim()) ? Number(v.trim()) : NaN)

export function SchemeReport({ scheme, initialShop }: { scheme: Other; initialShop?: string }) {
  const { t, lang } = useLang()
  const f = useFmt()
  const item = ITEM[scheme]
  const max = ITEM_INFO[item].max
  const groups = SCHEME_ISSUE_GROUPS[scheme]
  const [outlets, setOutlets] = useState<Shop[] | null>(null)
  const [loadErr, setLoadErr] = useState<unknown>(null)
  const [shop, setShop] = useState<Shop | null>(null)
  const [step, setStep] = useState<"outlet" | "month" | "amount" | `issues${number}` | "review" | "done">("outlet")
  const [month, setMonth] = useState(currentMonth())
  const [daysTxt, setDaysTxt] = useState("")
  const [rateTxt, setRateTxt] = useState("")
  const [entTxt, setEntTxt] = useState("")
  const [recTxt, setRecTxt] = useState("")
  const [issues, setIssues] = useState(0)
  const [lifetimeDays, setLifetimeDays] = useState<number>(90)
  const [allowExtension, setAllowExtension] = useState(true)
  const [separateId, setSeparateId] = useState(() => getPrefs().separateIds)
  const [idTouched, setIdTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [queued, setQueued] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneKey, setDoneKey] = useState<string | null>(null)

  useEffect(() => {
    loadOutlets()
      .then((all) => {
        const mine = all.filter((s) => s.scheme === scheme)
        setOutlets(mine)
        const pre = mine.find((s) => s.shopId === initialShop)
        if (pre) {
          setShop(pre)
          setStep("month")
        }
      })
      .catch(setLoadErr)
  }, [scheme, initialShop])
  useEffect(() => {
    if (!idTouched && (issues & SENSITIVE[scheme]) !== 0) setSeparateId(true)
  }, [issues, idTouched, scheme])

  if (loadErr) return <ErrorBox error={loadErr} />
  if (!outlets) return <Loading />
  const label = (s: Shop) => (lang === "hi" ? s.labelHi : s.labelEn)

  // Amounts in the scheme's unit. MGNREGA: owed = days worked × the daily wage on the job card.
  const days = whole(daysTxt)
  const rate = whole(rateTxt)
  const entitled = scheme === "nrega" ? (Number.isFinite(days) && Number.isFinite(rate) ? days * rate : NaN) : whole(entTxt)
  const received = whole(recTxt)
  const amountOk = Number.isFinite(entitled) && entitled > 0 && entitled <= max && Number.isFinite(received) && received >= 0 && received <= entitled
  const shortfall = amountOk ? entitled - received : 0

  const head = (title: string) => (
    <>
      <p class="small muted">{t(`schemeLong_${scheme}` as Key)}</p>
      {step !== "outlet" && (
        <button class="link-back" onClick={() => setStep(prevStep())}>
          ← {t("back")}
        </button>
      )}
      <h2>{title}</h2>
    </>
  )
  function prevStep(): typeof step {
    if (step === "month") return "outlet"
    if (step === "amount") return "month"
    if (step === "issues0") return "amount"
    if (step.startsWith("issues")) return `issues${Number(step.slice(6)) - 1}`
    if (step === "review") return `issues${groups.length - 1}`
    return "outlet"
  }

  if (step === "outlet")
    return (
      <section class="card easy report-step">
        {head(t(`sqOutlet_${scheme}` as Key))}
        <div class="bigcol">
          {outlets.map((s) => (
            <button class="big-choice" onClick={() => (setShop(s), setStep("month"))}>
              {label(s)} <span class="small muted mono">{s.shopId}</span>
            </button>
          ))}
        </div>
      </section>
    )
  if (!shop) return <Loading />

  if (step === "month")
    return (
      <section class="card easy report-step">
        {head(t("sqMonth"))}
        <div class="bigcol">
          {[0, -1, -2].map((n) => {
            const m = addMonths(currentMonth(), n)
            return (
              <button class={`big-choice ${m === month ? "selected" : ""}`} onClick={() => (setMonth(m), setStep("amount"))}>
                {f.month(m)}
              </button>
            )
          })}
        </div>
      </section>
    )

  if (step === "amount")
    return (
      <section class="card easy report-step">
        {head(label(shop))}
        {scheme === "mdm" ? (
          <label class="field">
            {t("sqEntitled_mdm")}
            <input class="big-input" inputMode="numeric" value={entTxt} onInput={(e) => setEntTxt(e.currentTarget.value)} placeholder="22" />
          </label>
        ) : (
          <>
            <label class="field">
              {t("sqDays_nrega")}
              <input class="big-input" inputMode="numeric" value={daysTxt} onInput={(e) => setDaysTxt(e.currentTarget.value)} placeholder="12" />
            </label>
            <label class="field">
              {t("sqRate_nrega")}
              <input class="big-input" inputMode="numeric" value={rateTxt} onInput={(e) => setRateTxt(e.currentTarget.value)} placeholder="250" />
            </label>
            {Number.isFinite(entitled) && entitled > 0 && (
              <p class="small">
                {t("sqWorkedOut", { days: String(days), rate: String(rate) })} = <strong>{f.amt(item, entitled)}</strong>
              </p>
            )}
          </>
        )}
        <label class="field">
          {t(`sqReceived_${scheme}` as Key)}
          <input class="big-input" inputMode="numeric" value={recTxt} onInput={(e) => setRecTxt(e.currentTarget.value)} placeholder={scheme === "mdm" ? "15" : "1500"} />
        </label>
        <p class="small muted">{t("sqNumberHelp")}</p>
        <button class="big-action" disabled={!amountOk} onClick={() => setStep("issues0")}>
          {t("next")} →
        </button>
      </section>
    )

  if (step.startsWith("issues")) {
    const i = Number(step.slice(6))
    const g = groups[i]!
    const title = t(`issueGroup_${g.id}` as Key)
    return (
      <section class="card easy report-step" key={step}>
        {head(title)}
        <p class="small muted">
          {i + 1} / {groups.length}
        </p>
        <p class="small">{t("sqIssues")}</p>
        <SchemeIssuePicker scheme={scheme} value={issues} onChange={setIssues} only={g.issues} />
        <button class="big-action" onClick={() => setStep(i + 1 < groups.length ? `issues${i + 1}` : "review")}>
          {t("next")} →
        </button>
      </section>
    )
  }

  if (step === "review") {
    const save = async () => {
      setError(null)
      const input = { shopId: shop.shopId, month, item, entitledG: entitled, receivedG: received, issues }
      if (!navigator.onLine || getSendLater()) {
        enqueueReport(input, shop, { opts: { lifetimeDays, allowExtension, separateId }, delayed: getSendLater() })
        setQueued(true)
        return
      }
      try {
        setBusy(true)
        const res = await fileReport(input, shop, { lifetimeDays, allowExtension, separateId })
        setDoneKey(res.entityKey)
        setStep("done")
      } catch (e) {
        if (e instanceof DuplicateError) setError(t("alreadyReported"))
        else if (e instanceof SeparateIdError) setError(t("separateIdFailed"))
        else if (e instanceof GasError) setError(t("gasFailed"))
        else if (isOffline(e)) {
          enqueueReport(input, shop, { opts: { lifetimeDays, allowExtension, separateId } })
          setQueued(true)
        } else setError(t("errGeneric"))
      } finally {
        setBusy(false)
      }
    }
    return (
      <section class="card easy report-step">
        {head(label(shop))}
        <p class="small">{f.month(month)}</p>
        <div class="summary">
          <div>
            <span>{t("summaryShould")}</span>
            <strong>{f.amt(item, entitled)}</strong>
          </div>
          <div>
            <span>{t("summaryGot")}</span>
            <strong>{f.amt(item, received)}</strong>
          </div>
          <div class={shortfall > 0 ? "bad" : "ok"}>
            <span>{t("summaryLess")}</span>
            <strong>{f.amt(item, shortfall)}</strong>
          </div>
        </div>
        <IssueList mask={issues} scheme={scheme} />
        <details class="more-options">
          <summary>{t("moreOptions")}</summary>
          <p class="small">{t("lifetimeTitle")}</p>
          <div class="row wrap">
            {REPORT_LIFETIME_CHOICES.map((d) => (
              <label class="inline">
                <input type="radio" name="scheme-lifetime" checked={lifetimeDays === d} onChange={() => setLifetimeDays(d)} /> {t("lifetimeDays", { n: d })}
              </label>
            ))}
          </div>
          <label class="inline check">
            <input type="checkbox" checked={allowExtension} onChange={(e) => setAllowExtension(e.currentTarget.checked)} /> {t("allowExtend")}
          </label>
          <label class="inline check">
            <input type="checkbox" checked={separateId} onChange={(e) => (setIdTouched(true), setSeparateId(e.currentTarget.checked))} /> {t("separateIdLabel")}
          </label>
        </details>
        <PublicPreview separateId={separateId} issues={issues} shopId={shop.shopId} month={month} scheme={scheme} sensitive={(issues & SENSITIVE[scheme]) !== 0} />
        <p class="notice">{t("permanentWarning")}</p>
        {queued ? (
          <p class="ok" role="status">
            <QueuedNote />
          </p>
        ) : (
          <button class="big-action" disabled={busy} onClick={save}>
            <ActionIcon name="send" />
            {busy ? t("sending") : `✓ ${t("sendEasy")}`}
          </button>
        )}
        {error && (
          <p class="err" role="alert">
            {error}
          </p>
        )}
      </section>
    )
  }

  if (step === "done" && doneKey) {
    const url = `${location.origin}${location.pathname}#/r/${doneKey}`
    const text = t("waText", { shop: label(shop), month: f.month(month) })
    return (
      <section class="card easy success report-step">
        <h2>✓ {t("sqSaved")}</h2>
        <p>{t("askNeighbours")}</p>
        <a class="big-action whatsapp" href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noopener">
          <ActionIcon name="share" />
          {t("shareWhatsApp")}
        </a>
        <a class="big-action secondary" href={`#/shop/${shop.shopId}`}>
          <ActionIcon name="shop" />
          {t("schemeSeeBtn")}
        </a>
        <a class="big-action secondary" href={`#/shop/${shop.shopId}?letter=complaint`}>
          <ActionIcon name="letter" />
          {t("draftComplaint")}
        </a>
        <a class="link-back" href={`#/r/${doneKey}`}>
          {t("detailsAuditors")} →
        </a>
      </section>
    )
  }
  return <Loading />
}

/** "Which scheme is this about?": shown above the report screens. Ration keeps its own flows; the others use SchemeReport. */
export function SchemeChooser({ scheme }: { scheme: Scheme }) {
  const { t } = useLang()
  return (
    <nav class="scheme-chooser" aria-label={t("whichScheme")}>
      <span class="small muted">{t("whichScheme")}</span>
      {(["pds", "mdm", "nrega"] as const).map((s) => (
        <a class={`chip ${s === scheme ? "selected" : ""}`} href={s === "pds" ? "#/report" : `#/report?scheme=${s}`} aria-current={s === scheme ? "page" : undefined}>
          {t(`scheme_${s}` as Key)}
        </a>
      ))}
    </nav>
  )
}
