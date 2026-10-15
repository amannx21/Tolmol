import { ActionIcon } from "./ActionIcon"
import { useEffect, useMemo, useState } from "preact/hooks"
import {
  addMonths,
  currentMonth,
  DuplicateError,
  formatBp,
  ITEMS,
  kgToGrams,
  NFSA,
  REPORT_LIFETIME_CHOICES,
  shortfallBp,
  validateReportInput,
  ValidationError,
  type Item,
  type Shop,
} from "tolmol-sdk"
import { fileReport, GasError, SeparateIdError } from "./arkiv"
import { getPrefs } from "./prefs"
import { useVerified } from "./verified"
import { device } from "./arkiv"
import { STATE_NAMES, useFmt, useLang } from "./i18n"
import { IssueList, IssuePicker, PublicPreview, SENSITIVE_ISSUES } from "./extras"
import { enqueueReport, isOffline } from "./queue"
import { go } from "./router"
import { DeviceCard, ErrorBox, Loading, loadShops } from "./ui"
import { ReportIntro } from "./ReferencePhotos"

export function ReportForm({ initialShop }: { initialShop?: string }) {
  const { t, lang } = useLang()
  const f = useFmt()
  const [shops, setShops] = useState<Shop[] | null>(null)
  const [loadErr, setLoadErr] = useState<unknown>(null)
  const [state, setState] = useState("")
  const [district, setDistrict] = useState("")
  const [shopId, setShopId] = useState(initialShop ?? "")
  const [month, setMonth] = useState(currentMonth())
  const [item, setItem] = useState<Item>("rice")
  const [entitled, setEntitled] = useState("")
  const [received, setReceived] = useState("")
  const [members, setMembers] = useState("4")
  const [step, setStep] = useState<"form" | "confirm" | "sending">("form")
  const [error, setError] = useState<string | null>(null)
  const [queued, setQueued] = useState(false)
  const [issues, setIssues] = useState(0)
  const [lifetimeDays, setLifetimeDays] = useState(90)
  const [allowExtension, setAllowExtension] = useState(true)
  const [separateId, setSeparateId] = useState(() => getPrefs().separateIds)
  // A report of being threatened or having the card kept gets a separate ID by default (the person can switch it off).
  const [idTouched, setIdTouched] = useState(false)
  useEffect(() => {
    if (!idTouched && (issues & SENSITIVE_ISSUES) !== 0) setSeparateId(true)
  }, [issues, idTouched])
  const verified = useVerified()
  const phoneVerified = !!verified?.has(device().account.address.toLowerCase())

  useEffect(() => {
    loadShops()
      .then((s) => {
        setShops(s)
        const pre = s.find((x) => x.shopId === initialShop)
        if (pre) {
          setState(pre.state)
          setDistrict(pre.district)
        }
      })
      .catch(setLoadErr)
  }, [])

  const states = useMemo(() => [...new Set((shops ?? []).map((s) => s.state))].sort(), [shops])
  const districts = useMemo(() => [...new Set((shops ?? []).filter((s) => s.state === state).map((s) => s.district))].sort(), [shops, state])
  const shopList = (shops ?? []).filter((s) => s.state === state && s.district === district)
  const shop = (shops ?? []).find((s) => s.shopId === shopId)
  const months = Array.from({ length: 12 }, (_, i) => addMonths(currentMonth(), -i))

  // Parse quantities without floating point; show the shortfall as the person types.
  let parsed: { e: number; r: number; bp: number } | null = null
  try {
    const e = kgToGrams(entitled)
    const r = kgToGrams(received)
    parsed = { e, r, bp: shortfallBp(e, r) }
  } catch {
    parsed = null
  }

  const review = () => {
    setError(null)
    try {
      if (!shop) throw new ValidationError("shop", t("chooseShop"))
      validateReportInput({ shopId: shop.shopId, month, item, entitledG: kgToGrams(entitled), receivedG: kgToGrams(received) })
      setStep("confirm")
    } catch (e) {
      const field = e instanceof ValidationError ? e.field : ""
      setError(field === "shop" ? t("errShop") : field === "month" ? t("errMonth") : t("errQty"))
    }
  }

  const send = async () => {
    if (!shop || !parsed) return
    setStep("sending")
    setError(null)
    const input = { shopId: shop.shopId, month, item, entitledG: parsed.e, receivedG: parsed.r, issues }
    if (!navigator.onLine) {
      enqueueReport(input, shop)
      setQueued(true)
      setStep("confirm")
      return
    }
    try {
      const res = await fileReport(input, shop, { lifetimeDays, allowExtension, separateId })
      go(`#/r/${res.entityKey}?new=1`)
    } catch (e) {
      setStep("confirm")
      if (e instanceof DuplicateError) setError(t("alreadyReported"))
      else if (e instanceof SeparateIdError) setError(t("separateIdFailed"))
      else if (e instanceof GasError) setError(t("gasFailed"))
      else if (isOffline(e)) {
        enqueueReport(input, shop)
        setQueued(true)
      } else setError(t("errGeneric"))
    }
  }

  if (loadErr) return <ErrorBox error={loadErr} />
  if (!shops) return <Loading />

  const label = (s: Shop) => (lang === "hi" ? s.labelHi : s.labelEn)

  if (step !== "form") {
    return (
      <section class="card">
        <h2>{t("preview")}</h2>
        <dl class="facts">
          <dt>{t("shop")}</dt>
          <dd>
            {shop && label(shop)} <span class="mono small">{shopId}</span>
          </dd>
          <dt>{t("month")}</dt>
          <dd>{f.month(month)}</dd>
          <dt>{t("item")}</dt>
          <dd>{t(item)}</dd>
          <dt>{t("lifetimeTitle")}</dt>
          <dd>{t("lifetimeDays", { n: lifetimeDays })}{allowExtension ? ` · ${t("allowExtend")}` : ""}{separateId ? ` · ${t("separateIdShort")}` : ""}</dd>
          <dt>{t("entitledKg")}</dt>
          <dd>{parsed && f.kg(parsed.e)}</dd>
          <dt>{t("receivedKg")}</dt>
          <dd>{parsed && f.kg(parsed.r)}</dd>
          <dt>{t("shortfall")}</dt>
          <dd>
            <strong>
              {parsed && `${f.kg(parsed.e - parsed.r)} (${formatBp(parsed.bp)})`}
            </strong>
          </dd>
        </dl>
        <IssueList mask={issues} />
        <PublicPreview separateId={separateId} issues={issues} />
        <p class="notice">{t("permanentWarning")}</p>
        {queued && (
          <p class="ok" role="status">
            {t("queued")}
          </p>
        )}
        <DeviceCard compact />
        {error && (
          <p class="err" role="alert">
            {error}
          </p>
        )}
        <div class="row">
          <button class="secondary" onClick={() => setStep("form")} disabled={step === "sending"}>
            <ActionIcon name="back" />{t("back")}
          </button>
          <button onClick={send} disabled={step === "sending" || queued}>
            <ActionIcon name="send" />{step === "sending" ? t("sending") : t("submit")}
          </button>
        </div>
      </section>
    )
  }

  const total = Number(members) > 0 && Number(members) < 30 ? NFSA.phhPerPersonG * Math.floor(Number(members)) : 0

  return (
    <section class="card">
      <h2>{t("ctaReport")}</h2>
      <ReportIntro />
      <p class="small">
        <a href={`#/report?v=easy${shopId ? `&shop=${shopId}` : ""}`}>{t("easyWay")} →</a>
      </p>
      <label>
        {t("state")}
        <select value={state} onChange={(e) => (setState(e.currentTarget.value), setDistrict(""), setShopId(""))}>
          <option value="">—</option>
          {states.map((s) => (
            <option value={s}>{STATE_NAMES[s]?.[lang] ?? s}</option>
          ))}
        </select>
      </label>
      <label>
        {t("district")}
        <select value={district} disabled={!state} onChange={(e) => (setDistrict(e.currentTarget.value), setShopId(""))}>
          <option value="">—</option>
          {districts.map((d) => (
            <option value={d}>{f.district(d)}</option>
          ))}
        </select>
      </label>
      <label>
        {t("shop")}
        <select value={shopId} disabled={!district} onChange={(e) => setShopId(e.currentTarget.value)}>
          <option value="">{t("chooseShop")}</option>
          {shopList.map((s) => (
            <option value={s.shopId}>
              {label(s)} · {s.shopId}
            </option>
          ))}
        </select>
      </label>
      <div class="grid2">
        <label>
          {t("month")}
          <select value={month} onChange={(e) => setMonth(e.currentTarget.value)}>
            {months.map((m) => (
              <option value={m}>{f.month(m)}</option>
            ))}
          </select>
        </label>
        <label>
          {t("item")}
          <select value={item} onChange={(e) => setItem(e.currentTarget.value as Item)}>
            {ITEMS.map((i) => (
              <option value={i}>{t(i)}</option>
            ))}
          </select>
        </label>
      </div>
      <div class="grid2">
        <label>
          {t("entitledKg")}
          <input inputMode="decimal" autocomplete="off" placeholder="15" value={entitled} onInput={(e) => setEntitled(e.currentTarget.value)} />
        </label>
        <label>
          {t("receivedKg")}
          <input inputMode="decimal" autocomplete="off" placeholder="12.5" value={received} onInput={(e) => setReceived(e.currentTarget.value)} />
        </label>
      </div>
      {parsed && (
        <p class="shortfall" aria-live="polite">
          {t("shortfall")}: <strong>{f.kg(parsed.e - parsed.r)}</strong> ({formatBp(parsed.bp)})
        </p>
      )}
      <fieldset class="plain">
        <legend>{t("issuesTitle")}</legend>
        <IssuePicker value={issues} onChange={setIssues} />
      </fieldset>
      <fieldset class="plain">
        <legend>{t("lifetimeTitle")}</legend>
        <div class="row wrap">
          {REPORT_LIFETIME_CHOICES.map((d) => (
            <label class="inline">
              <input type="radio" name="lifetime" checked={lifetimeDays === d} onChange={() => setLifetimeDays(d)} /> {t("lifetimeDays", { n: d })}
            </label>
          ))}
        </div>
        <label class="inline check">
          <input type="checkbox" checked={allowExtension} onChange={(e) => setAllowExtension(e.currentTarget.checked)} /> {t("allowExtend")}
        </label>
        <label class="inline check">
          <input type="checkbox" checked={separateId} onChange={(e) => (setIdTouched(true), setSeparateId(e.currentTarget.checked))} /> {t("separateIdLabel")}
        </label>
        {separateId && phoneVerified && <p class="small muted">{t("separateIdNotVerified")}</p>}
      </fieldset>
      <details class="helper">
        <summary>{t("helperTitle")}</summary>
        <p class="small">{t("helperText")}</p>
        <label class="inline">
          {t("helperPhh")}{" "}
          <input class="tiny" inputMode="numeric" value={members} onInput={(e) => setMembers(e.currentTarget.value)} />
        </label>
        <p class="small">
          {t("helperTotal")}: <strong>{total ? f.kg(total) : "—"}</strong> · {t("helperAay")}: <strong>{f.kg(NFSA.aayPerFamilyG)}</strong>
        </p>
      </details>
      {error && (
        <p class="err" role="alert">
          {error}
        </p>
      )}
      <button onClick={review}><ActionIcon name="check" />{t("preview")} →</button>
    </section>
  )
}
