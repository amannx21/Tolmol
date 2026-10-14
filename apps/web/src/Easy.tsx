// Easy mode: one question per screen, big buttons, numbers set with +/- instead of typing, read aloud,
// no blockchain words, gas handled silently. Uses exactly the same SDK calls (and safeguards) as Full mode.
import { useEffect, useMemo, useState } from "preact/hooks"
import { addMonths, currentMonth, DuplicateError, formatKg, NFSA, submitReport, type Shop } from "tolmol-sdk"
import { device, ensureGas, reader } from "./arkiv"
import { setLang, STATE_NAMES, useFmt, useLang, type Lang } from "./i18n"
import { setPrefs, usePrefs } from "./prefs"
import { enqueueReport, isOffline } from "./queue"
import { go } from "./router"
import { speak } from "./speak"
import { ErrorBox, Loading, loadShops } from "./ui"

/** Speaks `text` whenever it changes, if read-aloud is on, and offers a Listen button. */
export function Say({ text }: { text: string }) {
  const { t, lang } = useLang()
  const [prefs] = usePrefs()
  useEffect(() => {
    if (prefs.voice) speak(text, lang)
  }, [text, lang, prefs.voice])
  return (
    <button class="listen" type="button" onClick={() => speak(text, lang)}>
      {t("listen")}
    </button>
  )
}

// ---------------------------------------------------------------- first visit
export function Welcome() {
  const { t, lang } = useLang()
  return (
    <section class="card easy">
      <h1>{t("welcomeTitle")}</h1>
      <h2>{t("chooseLang")}</h2>
      <div class="bigrow">
        {(["hi", "en"] as Lang[]).map((l) => (
          <button class={`big-choice ${lang === l ? "selected" : ""}`} onClick={() => setLang(l)}>
            {l === "hi" ? "हिन्दी" : "English"}
          </button>
        ))}
      </div>
      <h2>{t("chooseMode")}</h2>
      <div class="bigcol">
        <button class="big-choice" onClick={() => setPrefs({ mode: "easy", voice: true, chosen: true })}>
          <span class="icon" aria-hidden="true">👆</span>
          <strong>{t("modeEasy")}</strong>
          <span class="small">{t("modeEasyHelp")}</span>
        </button>
        <button class="big-choice" onClick={() => setPrefs({ mode: "full", voice: false, chosen: true })}>
          <span class="icon" aria-hidden="true">📊</span>
          <strong>{t("modeFull")}</strong>
          <span class="small">{t("modeFullHelp")}</span>
        </button>
      </div>
      <p class="small muted">{t("synthetic")}</p>
    </section>
  )
}

// ---------------------------------------------------------------- home
export function EasyHome() {
  const { t } = useLang()
  const [prefs] = usePrefs()
  return (
    <section class="easy">
      <p class="lead">{t("tagline")}</p>
      <Say text={t("startReport")} />
      <a class="big-action" href="#/report">
        <span class="icon" aria-hidden="true">⚖️</span>
        {t("startReport")}
      </a>
      {prefs.myShop && (
        <a class="big-action secondary" href={`#/shop/${prefs.myShop}`}>
          <span class="icon" aria-hidden="true">🏪</span>
          {t("seeMyShop")}
        </a>
      )}
      <a class="big-action secondary" href="#/dashboard">
        <span class="icon" aria-hidden="true">📋</span>
        {t("seeAllShops")}
      </a>
    </section>
  )
}

// ---------------------------------------------------------------- stepper
function Stepper({ grams, onChange, min = 0, max = 100_000 }: { grams: number; onChange: (g: number) => void; min?: number; max?: number }) {
  const { t } = useLang()
  const set = (g: number) => onChange(Math.max(min, Math.min(max, g)))
  return (
    <div class="stepper">
      <div class="stepper-value" aria-live="polite">
        {formatKg(grams).replace(" kg", "")} <span>{t("kg")}</span>
      </div>
      <div class="stepper-buttons">
        <button type="button" onClick={() => set(grams - 5000)} aria-label="-5 kg">−5</button>
        <button type="button" onClick={() => set(grams - 500)} aria-label="-0.5 kg">−½</button>
        <button type="button" onClick={() => set(grams + 500)} aria-label="+0.5 kg">+½</button>
        <button type="button" onClick={() => set(grams + 5000)} aria-label="+5 kg">+5</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- report wizard
type Step = "shop" | "month" | "card" | "members" | "entitled" | "received" | "review" | "done"

export function EasyReport({ initialShop }: { initialShop?: string }) {
  const { t, lang } = useLang()
  const f = useFmt()
  const kg = f.kg
  const [prefs] = usePrefs()
  const [shops, setShops] = useState<Shop[] | null>(null)
  const [loadErr, setLoadErr] = useState<unknown>(null)
  const [step, setStep] = useState<Step>("shop")
  const [history, setHistory] = useState<Step[]>([])
  const [shopId, setShopId] = useState<string | null>(initialShop ?? prefs.myShop)
  const [changing, setChanging] = useState(false)
  const [search, setSearch] = useState("")
  const [month, setMonth] = useState(currentMonth())
  const [members, setMembers] = useState(4)
  const [entitledG, setEntitledG] = useState(20_000)
  const [receivedG, setReceivedG] = useState(20_000)
  const [busy, setBusy] = useState<null | "preparing" | "sending">(null)
  const [error, setError] = useState<string | null>(null)
  const [queued, setQueued] = useState(false)
  const [doneKey, setDoneKey] = useState<string | null>(null)

  useEffect(() => {
    loadShops().then(setShops).catch(setLoadErr)
    // Get test gas quietly in the background, so the device is ready by the time the person taps Save.
    void ensureGas()
  }, [])

  const shop = shops?.find((s) => s.shopId === shopId)
  const label = (s: Shop) => (lang === "hi" ? s.labelHi : s.labelEn)
  const next = (s: Step) => {
    setHistory((h) => [...h, step])
    setStep(s)
    setError(null)
  }
  const back = () => {
    const h = [...history]
    const prev = h.pop()
    setHistory(h)
    if (prev) setStep(prev)
    else go("#/")
  }
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (shops ?? []).filter((s) => !q || s.shopId.toLowerCase().includes(q) || s.district.includes(q) || label(s).toLowerCase().includes(q) || (STATE_NAMES[s.state]?.[lang] ?? "").toLowerCase().includes(q) || f.district(s.district).toLowerCase().includes(q)).slice(0, 12)
  }, [shops, search, lang])

  if (loadErr) return <ErrorBox error={loadErr} />
  if (!shops) return <Loading />

  const shortfall = Math.max(0, entitledG - receivedG)
  const BackBtn = () => (
    <button class="link-back" type="button" onClick={back}>
      ← {t("back")}
    </button>
  )

  if (step === "shop") {
    const showPicker = changing || !shop
    return (
      <section class="card easy">
        <BackBtn />
        <h2>{t("qShop")}</h2>
        <p class="small">
          <a href={`#/report?v=full${shopId ? `&shop=${shopId}` : ""}`}>{t("fullForm")} →</a>
        </p>
        <Say text={showPicker ? t("qShop") : `${t("yourShop")}: ${shop ? label(shop) : ""}`} />
        {!showPicker && shop ? (
          <>
            <div class="shop-card">
              <span class="icon" aria-hidden="true">🏪</span>
              <strong>{label(shop)}</strong>
              <span class="mono small">{shop.shopId}</span>
            </div>
            <button class="big-action" onClick={() => next("month")}>✓ {t("yesThisShop")}</button>
            <button class="big-action secondary" onClick={() => setChanging(true)}>{t("changeShop")}</button>
          </>
        ) : (
          <>
            <input class="big-input" placeholder={t("searchShop")} value={search} onInput={(e) => setSearch(e.currentTarget.value)} />
            <div class="bigcol">
              {matches.map((s) => (
                <button
                  class="big-choice"
                  onClick={() => {
                    setShopId(s.shopId)
                    setPrefs({ myShop: s.shopId })
                    setChanging(false)
                    next("month")
                  }}
                >
                  <strong>{label(s)}</strong>
                  <span class="small mono">{s.shopId}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    )
  }

  if (step === "month") {
    return (
      <section class="card easy">
        <BackBtn />
        <h2>{t("qMonth")}</h2>
        <Say text={t("qMonth")} />
        <div class="bigcol">
          {[currentMonth(), addMonths(currentMonth(), -1)].map((m, i) => (
            <button class={`big-choice ${month === m ? "selected" : ""}`} onClick={() => (setMonth(m), next("card"))}>
              <strong>{i === 0 ? t("thisMonth") : t("lastMonth")}</strong>
              <span class="small">{f.month(m)}</span>
            </button>
          ))}
        </div>
        <label>
          {t("otherMonth")}
          <select value={month} onChange={(e) => setMonth(e.currentTarget.value)}>
            {Array.from({ length: 12 }, (_, i) => addMonths(currentMonth(), -i)).map((m) => (
              <option value={m}>{f.month(m)}</option>
            ))}
          </select>
        </label>
        <button class="big-action" onClick={() => next("card")}>{t("next")} →</button>
      </section>
    )
  }

  if (step === "card") {
    return (
      <section class="card easy">
        <BackBtn />
        <h2>{t("qCard")}</h2>
        <Say text={`${t("qCard")} ${t("cardAay")}: ${t("cardAayHelp")}. ${t("cardPhh")}: ${t("cardPhhHelp")}.`} />
        <div class="bigcol">
          <button class="big-choice" onClick={() => (setEntitledG(NFSA.aayPerFamilyG), setReceivedG(NFSA.aayPerFamilyG), next("entitled"))}>
            <strong>{t("cardAay")}</strong>
            <span class="small">{t("cardAayHelp")}</span>
          </button>
          <button class="big-choice" onClick={() => next("members")}>
            <strong>{t("cardPhh")}</strong>
            <span class="small">{t("cardPhhHelp")}</span>
          </button>
          <button class="big-choice" onClick={() => next("entitled")}>
            <strong>{t("cardKnow")}</strong>
          </button>
        </div>
      </section>
    )
  }

  if (step === "members") {
    return (
      <section class="card easy">
        <BackBtn />
        <h2>{t("qMembers")}</h2>
        <Say text={t("qMembers")} />
        <div class="people" aria-hidden="true">{"👤".repeat(Math.min(members, 12))}{members > 12 ? "…" : ""}</div>
        <div class="stepper">
          <div class="stepper-value" aria-live="polite">
            {members} <span>{t("people")}</span>
          </div>
          <div class="stepper-buttons">
            <button type="button" onClick={() => setMembers(Math.max(1, members - 1))} aria-label="-1">−1</button>
            <button type="button" onClick={() => setMembers(Math.min(20, members + 1))} aria-label="+1">+1</button>
          </div>
        </div>
        <button
          class="big-action"
          onClick={() => {
            setEntitledG(members * NFSA.phhPerPersonG)
            setReceivedG(members * NFSA.phhPerPersonG)
            next("entitled")
          }}
        >
          {t("next")} →
        </button>
      </section>
    )
  }

  if (step === "entitled") {
    return (
      <section class="card easy">
        <BackBtn />
        <h2>{t("qEntitled")}</h2>
        <Say text={`${t("qEntitled")} ${kg(entitledG)}`} />
        <Stepper grams={entitledG} onChange={(g) => (setEntitledG(g), setReceivedG(Math.min(receivedG, g)))} min={500} />
        <button class="big-action" onClick={() => next("received")}>{t("next")} →</button>
      </section>
    )
  }

  if (step === "received") {
    return (
      <section class="card easy">
        <BackBtn />
        <h2>{t("qReceived")}</h2>
        <Say text={t("qReceived")} />
        <Stepper grams={receivedG} onChange={setReceivedG} max={entitledG} />
        <button class="big-action" onClick={() => next("review")}>{t("next")} →</button>
      </section>
    )
  }

  if (step === "review" && shop) {
    const summary = `${t("summaryShould")} ${kg(entitledG)}. ${t("summaryGot")} ${kg(receivedG)}. ${t("summaryLess")} ${kg(shortfall)}.`
    const save = async () => {
      setError(null)
      const input = { shopId: shop.shopId, month, item: "total" as const, entitledG, receivedG }
      if (!navigator.onLine) {
        enqueueReport(input, shop)
        setQueued(true)
        return
      }
      try {
        setBusy("preparing")
        if (!(await ensureGas())) {
          setError(t("gasFailed"))
          return
        }
        setBusy("sending")
        const res = await submitReport(reader, device().writer, input, shop, { synthetic: true })
        setDoneKey(res.entityKey)
        next("done")
      } catch (e) {
        if (e instanceof DuplicateError) setError(t("alreadyReported"))
        else if (isOffline(e)) {
          enqueueReport(input, shop)
          setQueued(true)
        } else setError(t("errGeneric"))
      } finally {
        setBusy(null)
      }
    }
    return (
      <section class="card easy">
        <BackBtn />
        <h2>{label(shop)}</h2>
        <Say text={summary} />
        <div class="summary">
          <div><span>{t("summaryShould")}</span><strong>{kg(entitledG)}</strong></div>
          <div><span>{t("summaryGot")}</span><strong>{kg(receivedG)}</strong></div>
          <div class={shortfall > 0 ? "bad" : "ok"}><span>{t("summaryLess")}</span><strong>{kg(shortfall)}</strong></div>
        </div>
        {shortfall === 0 && <p class="small">{t("noShortfall")}</p>}
        <p class="notice">{t("permanentWarning")}</p>
        {queued ? (
          <p class="ok" role="status">{t("queued")}</p>
        ) : (
          <button class="big-action" disabled={busy !== null} onClick={save}>
            {busy === "preparing" ? t("preparing") : busy === "sending" ? t("sending") : `✓ ${t("sendEasy")}`}
          </button>
        )}
        {error && <p class="err" role="alert">{error}</p>}
      </section>
    )
  }

  if (step === "done" && doneKey && shop) {
    const url = `${location.origin}${location.pathname}#/r/${doneKey}`
    const text = t("waText", { shop: label(shop), month: f.month(month) })
    return (
      <section class="card easy success">
        <h2>✓ {t("doneEasy")}</h2>
        <Say text={`${t("doneEasy")} ${t("askNeighbours")}`} />
        <p>{t("askNeighbours")}</p>
        <a class="big-action whatsapp" href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noopener">
          {t("shareWhatsApp")}
        </a>
        {"share" in navigator && (
          <button class="big-action secondary" onClick={() => void navigator.share({ text, url }).catch(() => {})}>
            {t("share")}…
          </button>
        )}
        <a class="big-action secondary" href={`#/shop/${shop.shopId}`}>{t("seeMyShop")}</a>
        <a class="link-back" href={`#/r/${doneKey}`}>{t("detailsAuditors")} →</a>
      </section>
    )
  }

  return <Loading />
}
