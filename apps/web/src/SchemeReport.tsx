// Reporting for the other schemes on the same ledger: school meals (PM POSHAN) at a school, and MGNREGA wages at a
// gram panchayat. Same evidence model and the same Arkiv writes as a ration report (sealed, confirmable, answerable),
// and the same easy flow: one question per screen, read aloud in Hindi or English, big buttons and big + / − steps
// instead of typing, a progress bar, and the privacy protections of a ration report (what becomes public, separate ID
// for risky reports, send at a random time, small-outlet warning). MGNREGA wages are rounded to ₹500 by default,
// because muster rolls are public and exact amounts could be matched to a name.
import type { ComponentChildren } from "preact"
import { useEffect, useState } from "preact/hooks"
import {
  addMonths,
  coarsenWages,
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
import { Say } from "./Easy"
import { IssueList, NextSteps, PublicPreview, QueuedNote, SchemeIssuePicker } from "./extras"
import { useFmt, useLang, type Key } from "./i18n"
import { getPrefs } from "./prefs"
import { enqueueReport, getSendLater, isOffline } from "./queue"
import { speak } from "./speak"
import { ErrorBox, Loading, loadOutlets } from "./ui"

type Other = Exclude<Scheme, "pds">
const ITEM: Record<Other, "meal_days" | "wage_inr"> = { mdm: "meal_days", nrega: "wage_inr" }
/** Issues after which the person may face retaliation: a separate ID is switched on for them by default. */
export const SENSITIVE: Record<Other, number> = {
  mdm: SCHEME_ISSUES.mdm.money_asked! | SCHEME_ISSUES.mdm.seated_apart!,
  nrega: SCHEME_ISSUES.nrega.job_card_kept! | SCHEME_ISSUES.nrega.bribe_asked! | SCHEME_ISSUES.nrega.fake_names!,
}

type Step = "outlet" | "month" | "a1" | "a2" | "a3" | `issues${number}` | "review" | "done"
/** The amount questions, one per screen: school open days and meal days; or days worked, daily wage, wages paid. */
const AMOUNT_STEPS: Record<Other, Step[]> = { mdm: ["a1", "a2"], nrega: ["a1", "a2", "a3"] }

/** Big − / + buttons around a big number, with typing as a fallback (no keyboard needed for most people). */
function Stepper({ value, onChange, min, max, step, bigStep, prefix = "", suffix = "", label }: { value: number; onChange: (n: number) => void; min: number; max: number; step: number; bigStep?: number; prefix?: string; suffix?: string; label: string }) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  return (
    <div class="stepper" role="group" aria-label={label}>
      {bigStep && (
        <button type="button" class="big-step" onClick={() => onChange(clamp(value - bigStep))} aria-label={`− ${bigStep}`}>
          −{bigStep}
        </button>
      )}
      <button type="button" class="big-step" onClick={() => onChange(clamp(value - step))} aria-label={`− ${step}`}>
        −
      </button>
      <label class="stepper-value">
        <span class="sr-only">{label}</span>
        {prefix}
        <input inputMode="numeric" value={String(value)} onInput={(e) => /^\d{0,6}$/.test(e.currentTarget.value) && onChange(clamp(Number(e.currentTarget.value || 0)))} />
        {suffix}
      </label>
      <button type="button" class="big-step" onClick={() => onChange(clamp(value + step))} aria-label={`+ ${step}`}>
        +
      </button>
      {bigStep && (
        <button type="button" class="big-step" onClick={() => onChange(clamp(value + bigStep))} aria-label={`+ ${bigStep}`}>
          +{bigStep}
        </button>
      )}
    </div>
  )
}

function SchemeProgress({ scheme, step }: { scheme: Other; step: Step }) {
  const { t } = useLang()
  const stage = step === "outlet" || step === "month" ? 0 : step.startsWith("issues") ? 2 : step === "review" ? 3 : 1
  const labels = [t(`progOutlet_${scheme}` as Key), t(`progAmount_${scheme}` as Key), t("progIssues"), t("progReview")]
  return (
    <div class="report-progress" aria-label={t("progLabel")}>
      <div class="progress-caption">
        <span>{labels[stage]}</span>
        <span>
          {stage + 1} / {labels.length}
        </span>
      </div>
      <ol>
        {labels.map((label, index) => (
          <li key={label} class={index <= stage ? "reached" : ""} aria-current={index === stage ? "step" : undefined}>
            <span class="sr-only">{label}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function SchemeReport({ scheme, initialShop }: { scheme: Other; initialShop?: string }) {
  const { t, lang } = useLang()
  const f = useFmt()
  const item = ITEM[scheme]
  const max = ITEM_INFO[item].max
  const groups = SCHEME_ISSUE_GROUPS[scheme]
  const amountSteps = AMOUNT_STEPS[scheme]
  const [outlets, setOutlets] = useState<Shop[] | null>(null)
  const [loadErr, setLoadErr] = useState<unknown>(null)
  const [shop, setShop] = useState<Shop | null>(null)
  const [step, setStep] = useState<Step>("outlet")
  const [history, setHistory] = useState<Step[]>([])
  const [month, setMonth] = useState(currentMonth())
  // School meals: open days and meal days. MGNREGA: days worked, daily wage, wages paid.
  const [openDays, setOpenDays] = useState(22)
  const [mealDays, setMealDays] = useState(22)
  const [workDays, setWorkDays] = useState(10)
  const [rate, setRate] = useState(250)
  const [paid, setPaid] = useState(2500)
  const [roundWages, setRoundWages] = useState(true)
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
  // Keep "what you got" within "what you were due" as the first number changes.
  useEffect(() => setMealDays((m) => Math.min(m, openDays)), [openDays])
  const owed = workDays * rate
  useEffect(() => setPaid((p) => Math.min(p, owed)), [owed])

  if (loadErr) return <ErrorBox error={loadErr} />
  if (!outlets) return <Loading />
  const label = (s: Shop) => (lang === "hi" ? s.labelHi : s.labelEn)
  const next = (s: Step) => {
    setHistory((h) => [...h, step])
    setStep(s)
  }
  const back = () => {
    const prev = history[history.length - 1]
    if (!prev) return
    setHistory((h) => h.slice(0, -1))
    setStep(prev)
  }
  const nextAmount = (s: Step): Step => amountSteps[amountSteps.indexOf(s) + 1] ?? "issues0"

  // What is written: school days as they are; wages rounded to ₹500 unless the person chose exact amounts.
  const exactPaid = Math.min(paid, owed)
  const written =
    scheme === "mdm"
      ? { e: openDays, r: Math.min(mealDays, openDays) }
      : roundWages && owed > 0
        ? (({ owed: e, paid: r }) => ({ e, r }))(coarsenWages(owed, exactPaid))
        : { e: owed, r: exactPaid }
  const amountOk = written.e > 0 && written.e <= max && written.r >= 0 && written.r <= written.e
  const shortfall = amountOk ? written.e - written.r : 0

  const frame = (title: string, sayText: string, body: ComponentChildren) => (
    <section class="card easy report-step" key={step}>
      <SchemeProgress scheme={scheme} step={step} />
      {history.length > 0 && (
        <button class="link-back" onClick={back}>
          ← {t("back")}
        </button>
      )}
      <p class="small muted">{t(`schemeLong_${scheme}` as Key)}</p>
      <h2>{title}</h2>
      <Say text={sayText} />
      {body}
    </section>
  )

  if (step === "outlet")
    return frame(
      t(`sqOutlet_${scheme}` as Key),
      t(`sqOutlet_${scheme}` as Key),
      <div class="bigcol">
        {outlets.map((s) => (
          <button
            class="big-choice"
            onClick={() => {
              setShop(s)
              next("month")
            }}
          >
            <span class="icon" aria-hidden="true">
              {scheme === "mdm" ? "🏫" : "🏛️"}
            </span>
            <strong>{label(s)}</strong>
            <span class="small mono">{s.shopId}</span>
          </button>
        ))}
      </div>,
    )
  if (!shop) return <Loading />

  if (step === "month")
    return frame(
      t("sqMonth"),
      t("sqMonth"),
      <div class="bigcol">
        {[0, -1, -2].map((n) => {
          const m = addMonths(currentMonth(), n)
          return (
            <button
              class={`big-choice ${m === month ? "selected" : ""}`}
              onClick={() => {
                setMonth(m)
                next(amountSteps[0]!)
              }}
            >
              <span class="icon" aria-hidden="true">
                📅
              </span>
              <strong>{f.month(m)}</strong>
            </button>
          )
        })}
      </div>,
    )

  if (step === "a1" || step === "a2" || step === "a3") {
    const days = ` ${t("unitDays")}`
    const q =
      scheme === "mdm"
        ? step === "a1"
          ? { title: t("sqEntitled_mdm"), el: <Stepper label={t("sqEntitled_mdm")} value={openDays} onChange={setOpenDays} min={1} max={31} step={1} bigStep={5} suffix={days} /> }
          : { title: t("sqReceived_mdm"), el: <Stepper label={t("sqReceived_mdm")} value={mealDays} onChange={setMealDays} min={0} max={openDays} step={1} bigStep={5} suffix={days} /> }
        : step === "a1"
          ? { title: t("sqDays_nrega"), el: <Stepper label={t("sqDays_nrega")} value={workDays} onChange={setWorkDays} min={1} max={31} step={1} bigStep={5} suffix={days} /> }
          : step === "a2"
            ? { title: t("sqRate_nrega"), el: <Stepper label={t("sqRate_nrega")} value={rate} onChange={setRate} min={1} max={3000} step={10} bigStep={50} prefix="₹" /> }
            : { title: t("sqReceived_nrega"), el: <Stepper label={t("sqReceived_nrega")} value={exactPaid} onChange={setPaid} min={0} max={owed} step={50} bigStep={500} prefix="₹" /> }
    const valid = scheme === "mdm" ? openDays > 0 : owed > 0 && owed <= max
    return frame(
      q.title,
      q.title,
      <>
        {q.el}
        {scheme === "nrega" && step !== "a1" && (
          <p class="small">
            {t("sqWorkedOut", { days: String(workDays), rate: String(rate) })} = <strong>{f.amt(item, owed)}</strong>
          </p>
        )}
        <button class="big-action" disabled={!valid} onClick={() => next(nextAmount(step))}>
          {t("next")} →
        </button>
      </>,
    )
  }

  if (step.startsWith("issues")) {
    const i = Number(step.slice(6))
    const g = groups[i]!
    const title = t(`issueGroup_${g.id}` as Key)
    return frame(
      title,
      `${title} ${t("sqIssues")}`,
      <>
        <p class="small muted">
          {i + 1} / {groups.length}
        </p>
        <p class="small">{t("sqIssues")}</p>
        <SchemeIssuePicker scheme={scheme} value={issues} onChange={setIssues} only={g.issues} />
        <button class="big-action" onClick={() => next(i + 1 < groups.length ? `issues${i + 1}` : "review")}>
          {t("next")} →
        </button>
      </>,
    )
  }

  if (step === "review") {
    const save = async () => {
      setError(null)
      const input = { shopId: shop.shopId, month, item, entitledG: written.e, receivedG: written.r, issues }
      if (!navigator.onLine || getSendLater()) {
        enqueueReport(input, shop, { opts: { lifetimeDays, allowExtension, separateId }, delayed: getSendLater() })
        setQueued(true)
        return
      }
      try {
        setBusy(true)
        const res = await fileReport(input, shop, { lifetimeDays, allowExtension, separateId })
        setDoneKey(res.entityKey)
        next("done")
        speak(t("sqSaved"), lang)
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
    const summary = `${t("summaryShould")} ${f.amt(item, written.e)}. ${t("summaryGot")} ${f.amt(item, written.r)}. ${t("summaryLess")} ${f.amt(item, shortfall)}.`
    return frame(
      label(shop),
      summary,
      <>
        <p class="small">{f.month(month)}</p>
        <div class="summary">
          <div>
            <span>{t("summaryShould")}</span>
            <strong>{f.amt(item, written.e)}</strong>
          </div>
          <div>
            <span>{t("summaryGot")}</span>
            <strong>{f.amt(item, written.r)}</strong>
          </div>
          <div class={shortfall > 0 ? "bad" : "ok"}>
            <span>{t("summaryLess")}</span>
            <strong>{f.amt(item, shortfall)}</strong>
          </div>
        </div>
        {scheme === "nrega" && roundWages && (written.e !== owed || written.r !== exactPaid) && (
          <p class="small notice">{t("wageRounded", { owed: f.amt(item, owed), paid: f.amt(item, exactPaid) })}</p>
        )}
        <IssueList mask={issues} scheme={scheme} />
        <details class="more-options">
          <summary>{t("moreOptions")}</summary>
          {scheme === "nrega" && (
            <label class="inline check">
              <input type="checkbox" checked={roundWages} onChange={(e) => setRoundWages(e.currentTarget.checked)} /> {t("wageRoundLabel")}
            </label>
          )}
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
            <input
              type="checkbox"
              checked={separateId}
              onChange={(e) => {
                setIdTouched(true)
                setSeparateId(e.currentTarget.checked)
              }}
            />{" "}
            {t("separateIdLabel")}
          </label>
        </details>
        <PublicPreview separateId={separateId} issues={issues} shopId={shop.shopId} month={month} scheme={scheme} sensitive={(issues & SENSITIVE[scheme]) !== 0} />
        <p class="notice">{t("permanentWarning")}</p>
        {queued ? (
          <p class="ok" role="status">
            <QueuedNote />
          </p>
        ) : (
          <button class="big-action" disabled={busy || !amountOk} onClick={save}>
            <ActionIcon name="send" />
            {busy ? t("sending") : `✓ ${t("sendEasy")}`}
          </button>
        )}
        {error && (
          <p class="err" role="alert">
            {error}
          </p>
        )}
      </>,
    )
  }

  if (step === "done" && doneKey) {
    const url = `${location.origin}${location.pathname}#/r/${doneKey}`
    const text = t("waText", { shop: label(shop), month: f.month(month) })
    return (
      <section class="card easy success report-step">
        <h2>✓ {t("sqSaved")}</h2>
        <Say text={`${t("sqSaved")} ${t("askNeighbours")}`} />
        <p>{t("askNeighbours")}</p>
        <a class="big-action whatsapp" href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noopener">
          <ActionIcon name="share" />
          {t("shareWhatsApp")}
        </a>
        <a class="big-action secondary" href={`#/shop/${shop.shopId}`}>
          <ActionIcon name="shop" />
          {t("schemeSeeBtn")}
        </a>
        <a class="link-back" href={`#/r/${doneKey}`}>
          {t("detailsAuditors")} →
        </a>
        <NextSteps shopId={shop.shopId} mask={issues} scheme={scheme} />
      </section>
    )
  }
  return <Loading />
}
