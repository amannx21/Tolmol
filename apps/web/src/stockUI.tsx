// Shop page: the dealer's stock board (what arrived, when it is given out) read against what card holders got, and
// the "Fair shop" badge. Both are worked out in the browser from public Arkiv data (tolmol-sdk stock.ts), so anyone
// who reads the same entities gets the same answer.
import { useEffect, useMemo, useState } from "preact/hooks"
import qrcode from "qrcode-generator"
import {
  boardForMonth,
  boardMissing,
  currentMonth,
  fairShop,
  latestFollowups,
  leakageEstimate,
  postStockBoard,
  shopFollowups,
  shopResponses,
  shopStocks,
  shopBoards,
  validBoards,
  boardGap,
  postBoard,
  type BoardValues,
  type OutletBoard,
  validResponses,
  validStocks,
  type FairCheck,
  type Followup,
  type Report,
  type Response,
  type Shop,
  type StockBoard,
} from "tolmol-sdk"
import { ActionIcon } from "./ActionIcon"
import { device, ensureGas, reader, short } from "./arkiv"
import { useFmt, useLang, type Key } from "./i18n"
import { useDealers } from "./verified"

type Evidence = { boards: StockBoard[]; outletBoards: OutletBoard[]; answers: Map<string, Response[]>; followups: Map<string, Followup> }

/** The shop's valid boards, answers and follow-ups (three queries, shared by both cards). */
function useEvidence(shopId: string, counted: Report[], scheme: Shop["scheme"]) {
  const dealers = useDealers()
  const [raw, setRaw] = useState<{ b: StockBoard[]; ob: OutletBoard[]; r: Response[]; f: Followup[] } | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    // Ration shops post stock boards; schools and panchayats post their own monthly boards.
    const boards = scheme === "pds" ? shopStocks(reader, shopId).then((x) => ({ b: x.items, ob: [] as OutletBoard[] })) : shopBoards(reader, shopId).then((x) => ({ b: [] as StockBoard[], ob: x.items }))
    Promise.all([boards, shopResponses(reader, shopId), shopFollowups(reader, shopId)])
      .then(([bb, r, f]) => live && setRaw({ ...bb, r: r.items, f: f.items }))
      .catch(() => live && setRaw({ b: [], ob: [], r: [], f: [] }))
    return () => {
      live = false
    }
  }, [shopId, tick, scheme])
  const ev = useMemo<Evidence | null>(() => {
    if (!raw || !dealers) return null
    return { boards: validStocks(raw.b, dealers).get(shopId) ?? [], outletBoards: validBoards(raw.ob, dealers, shopId), answers: validResponses(counted, raw.r, dealers), followups: latestFollowups(counted, raw.f) }
  }, [raw, dealers, counted, shopId])
  return { ev, dealers, reload: () => setTick((n) => n + 1) }
}

const kgText = (g: number) => (g / 1000).toLocaleString("en-IN", { maximumFractionDigits: 1 })

export function StockAndFairness({ shop, counted, month }: { shop: Shop; counted: Report[]; month?: string }) {
  const { ev, dealers, reload } = useEvidence(shop.shopId, counted, shop.scheme)
  if (!ev || !dealers) return null
  const m = month ?? currentMonth()
  return (
    <>
      <FairShopCard shop={shop} counted={counted} ev={ev} />
      {shop.scheme === "pds" ? (
        <StockBoardCard shop={shop} counted={counted} ev={ev} month={m} iAmDealer={dealers.get(device().account.address.toLowerCase())?.shopId === shop.shopId} onPosted={reload} />
      ) : (
        <OutletBoardCard shop={shop} counted={counted} boards={ev.outletBoards} month={m} iAmOperator={dealers.get(device().account.address.toLowerCase())?.shopId === shop.shopId} onPosted={reload} />
      )}
    </>
  )
}

function FairShopCard({ shop, counted, ev }: { shop: Shop; counted: Report[]; ev: Evidence }) {
  const { t } = useLang()
  const f = useFmt()
  const v = fairShop({ reports: counted, answers: ev.answers, followups: ev.followups, boards: shop.scheme === "pds" ? ev.boards : ev.outletBoards, month: currentMonth(), scheme: shop.scheme })
  const url = `${location.origin}${location.pathname}#/shop/${shop.shopId}`
  const svg = useMemo(() => {
    const qr = qrcode(0, "M")
    qr.addData(url)
    qr.make()
    return qr.createSvgTag({ cellSize: 3, margin: 2, scalable: true })
  }, [url])
  return (
    <section class={`card fair-badge ${v.fair ? "is-fair" : "not-fair"}`} aria-live="polite">
      <h3>{v.fair ? `🏅 ${t("fairYes")}` : t("fairNo")}</h3>
      <p class="small">{t("fairHelp", { a: f.month(v.months[0]!), b: f.month(v.months[1]!) })}</p>
      <ul class="checks">
        {(["enough_reports", "low_shortfall", "all_answered", "none_not_fixed", "board_posted"] as FairCheck[]).map((c) => (
          <li class={v.failed.includes(c) ? "bad" : "ok"}>
            {v.failed.includes(c) ? "✗" : "✓"} {t(`fair_${c}` as Key)}
          </li>
        ))}
      </ul>
      {v.fair && (
        <div class="row wrap">
          <div class="qr small-qr" role="img" aria-label={url} dangerouslySetInnerHTML={{ __html: svg }} />
          <p class="small">{t("fairQr")}</p>
        </div>
      )}
    </section>
  )
}

function StockBoardCard({ shop, counted, ev, month, iAmDealer, onPosted }: { shop: Shop; counted: Report[]; ev: Evidence; month: string; iAmDealer: boolean; onPosted: () => void }) {
  const { t } = useLang()
  const f = useFmt()
  const board = boardForMonth(ev.boards, month)
  const missing = boardMissing(ev.boards, month)
  const monthReports = counted.filter((r) => r.month === month)
  const est = board ? leakageEstimate(board.latest, monthReports) : null
  return (
    <section class="card stock-board">
      <h3>
        {t("stockTitle")} · {f.month(month)}
      </h3>
      {board ? (
        <>
          <div class="statrow">
            <div>
              <div class="big">{kgText(board.latest.riceG)}</div>
              <div class="label">{t("rice")} (kg)</div>
            </div>
            <div>
              <div class="big">{kgText(board.latest.wheatG)}</div>
              <div class="label">{t("wheat")} (kg)</div>
            </div>
            {board.latest.milletG > 0 && (
              <div>
                <div class="big">{kgText(board.latest.milletG)}</div>
                <div class="label">{t("millet")} (kg)</div>
              </div>
            )}
            <div>
              <div class="big">{board.latest.cards}</div>
              <div class="label">{t("stockCards")}</div>
            </div>
          </div>
          <p class="small">{t("stockDays", { from: board.latest.fromDay, to: board.latest.toDay })}</p>
          {est && est.reports > 0 && (
            <p class={est.unaccountedG > 0 ? "notice" : "ok"}>
              {est.unaccountedG > 0
                ? t("stockGap", { n: est.reports, pct: (est.shortfallBp / 100).toFixed(1), kg: kgText(est.unaccountedG), total: kgText(est.declaredG) })
                : t("stockNoGap", { n: est.reports })}
            </p>
          )}
          {board.versions.length > 1 && (
            <details class="small">
              <summary>{t("stockChanged", { n: board.versions.length - 1 })}</summary>
              <ol>
                {board.versions.map((b) => (
                  <li>
                    #{b.createdAt.toString()}: {t("rice")} {kgText(b.riceG)} kg · {t("wheat")} {kgText(b.wheatG)} kg · {t("stockCards")} {b.cards} · {short(b.key)}
                  </li>
                ))}
              </ol>
            </details>
          )}
          <p class="small muted">{t("stockSealed", { dealer: short(board.latest.creator) })}</p>
        </>
      ) : missing ? (
        <p class="err" role="alert">
          {t("stockMissing", { month: f.month(month) })}
        </p>
      ) : (
        <p class="muted small">{t("stockNotYet")}</p>
      )}
      {iAmDealer && <PostBoard shop={shop} month={month} onPosted={onPosted} />}
    </section>
  )
}

function PostBoard({ shop, month, onPosted }: { shop: Shop; month: string; onPosted: () => void }) {
  const { t } = useLang()
  const [v, setV] = useState({ rice: "", wheat: "", millet: "0", cards: "", from: "1", to: "10" })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const n = (s: string) => (/^\d{1,6}$/.test(s.trim()) ? Number(s.trim()) : NaN)
  const vals = { riceG: n(v.rice) * 1000, wheatG: n(v.wheat) * 1000, milletG: n(v.millet) * 1000, cards: n(v.cards), fromDay: n(v.from), toDay: n(v.to) }
  const ok = Object.values(vals).every(Number.isFinite) && vals.riceG + vals.wheatG + vals.milletG > 0 && vals.cards > 0 && vals.fromDay >= 1 && vals.toDay <= 31 && vals.fromDay <= vals.toDay
  const field = (k: keyof typeof v, label: string) => (
    <label class="inline">
      {label} <input class="mono" inputMode="numeric" size={7} value={v[k]} onInput={(e) => setV({ ...v, [k]: e.currentTarget.value })} />
    </label>
  )
  const post = async () => {
    setBusy(true)
    setMsg(null)
    try {
      if (!(await ensureGas())) throw new Error("gas")
      await postStockBoard(reader, device().writer, shop, month, vals, { synthetic: true })
      setMsg({ ok: true, text: t("stockPosted") })
      onPosted()
    } catch {
      setMsg({ ok: false, text: t("errGeneric") })
    } finally {
      setBusy(false)
    }
  }
  return (
    <div class="dealer-answer">
      <h4>{t("stockPostTitle")}</h4>
      <div class="row wrap">
        {field("rice", `${t("rice")} (kg)`)}
        {field("wheat", `${t("wheat")} (kg)`)}
        {field("millet", `${t("millet")} (kg)`)}
        {field("cards", t("stockCards"))}
        {field("from", t("stockFrom"))}
        {field("to", t("stockTo"))}
      </div>
      <p class="small muted">{t("stockPostHelp")}</p>
      <button onClick={post} disabled={!ok || busy}>
        <ActionIcon name="save" />
        {busy ? t("sending") : t("stockPostBtn")}
      </button>
      {msg && <p class={msg.ok ? "ok" : "err"}>{msg.text}</p>}
    </div>
  )
}

// ------------------------------------------------------------------ schools and panchayats: their own monthly board
function OutletBoardCard({ shop, counted, boards, month, iAmOperator, onPosted }: { shop: Shop; counted: Report[]; boards: OutletBoard[]; month: string; iAmOperator: boolean; onPosted: () => void }) {
  const { t } = useLang()
  const f = useFmt()
  const scheme = shop.scheme === "mdm" ? "mdm" : "nrega"
  const b = boardForMonth(boards, month)
  const missing = boardMissing(boards, month)
  const gap = b ? boardGap(b.latest, counted.filter((r) => r.month === month)) : null
  const pct = (bp: number) => (bp / 100).toFixed(0)
  return (
    <section class="card stock-board">
      <h3>
        {t(`boardTitle_${scheme}` as Key)} · {f.month(month)}
      </h3>
      {b ? (
        <>
          {b.latest.scheme === "mdm" ? (
            <div class="statrow">
              <div><div class="big">{b.latest.children}</div><div class="label">{t("bChildren")}</div></div>
              <div><div class="big">{b.latest.mealDays}/{b.latest.openDays}</div><div class="label">{t("bMealDays")}</div></div>
              <div><div class="big">{kgText(b.latest.grainG)}</div><div class="label">{t("bGrain")} (kg)</div></div>
            </div>
          ) : (
            <div class="statrow">
              <div><div class="big">{b.latest.workers}</div><div class="label">{t("bWorkers")}</div></div>
              <div><div class="big">{b.latest.personDays}</div><div class="label">{t("bPersonDays")}</div></div>
              <div><div class="big">₹{b.latest.wagesPaidInr.toLocaleString("en-IN")}</div><div class="label">{t("bWagesPaid")}</div></div>
            </div>
          )}
          {gap && gap.reports > 0 && (
            <p class={gap.gapBp > 0 ? "notice" : "ok"}>
              {b.latest.scheme === "mdm"
                ? gap.gapBp > 0
                  ? t("bGapMdm", { claimed: pct(gap.claimedBp), reported: pct(gap.reportedBp), n: gap.reports })
                  : t("bNoGap", { n: gap.reports })
                : gap.unaccountedInr > 0
                  ? t("bGapNrega", { pct: pct(gap.gapBp), n: gap.reports, inr: gap.unaccountedInr.toLocaleString("en-IN"), total: b.latest.wagesPaidInr.toLocaleString("en-IN") })
                  : t("bNoGap", { n: gap.reports })}
            </p>
          )}
          {b.versions.length > 1 && <p class="small">{t("stockChanged", { n: b.versions.length - 1 })}</p>}
          <p class="small muted">{t(`bSealed_${scheme}` as Key, { op: short(b.latest.creator) })}</p>
        </>
      ) : missing ? (
        <p class="err" role="alert">
          {t(`bMissing_${scheme}` as Key, { month: f.month(month) })}
        </p>
      ) : (
        <p class="muted small">{t("stockNotYet")}</p>
      )}
      {iAmOperator && <PostOutletBoard shop={shop} scheme={scheme} month={month} onPosted={onPosted} />}
    </section>
  )
}

function PostOutletBoard({ shop, scheme, month, onPosted }: { shop: Shop; scheme: "mdm" | "nrega"; month: string; onPosted: () => void }) {
  const { t } = useLang()
  const [v, setV] = useState<Record<string, string>>(scheme === "mdm" ? { a: "", b: "22", c: "", d: "" } : { a: "", b: "", c: "250", d: "" })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const n = (s: string | undefined) => (/^\d{1,9}$/.test((s ?? "").trim()) ? Number((s ?? "").trim()) : NaN)
  const values: BoardValues =
    scheme === "mdm"
      ? { scheme, children: n(v.a), openDays: n(v.b), mealDays: n(v.c), grainG: n(v.d) * 1000 }
      : { scheme, workers: n(v.a), personDays: n(v.b), rateInr: n(v.c), wagesPaidInr: n(v.d) }
  const ok = Object.values(values).every((x) => typeof x === "string" || Number.isFinite(x)) && (scheme !== "mdm" || n(v.c) <= n(v.b))
  const labels = scheme === "mdm" ? [t("bChildren"), t("bOpenDays"), t("bMealDaysServed"), `${t("bGrain")} (kg)`] : [t("bWorkers"), t("bPersonDays"), `${t("bRate")} (₹)`, `${t("bWagesPaid")} (₹)`]
  const post = async () => {
    setBusy(true)
    setMsg(null)
    try {
      if (!(await ensureGas())) throw new Error("gas")
      await postBoard(reader, device().writer, shop, month, values, { synthetic: true })
      setMsg({ ok: true, text: t("stockPosted") })
      onPosted()
    } catch {
      setMsg({ ok: false, text: t("errGeneric") })
    } finally {
      setBusy(false)
    }
  }
  return (
    <div class="dealer-answer">
      <h4>{t(`bPostTitle_${scheme}` as Key)}</h4>
      <div class="row wrap">
        {(["a", "b", "c", "d"] as const).map((k, i) => (
          <label class="inline">
            {labels[i]} <input class="mono" inputMode="numeric" size={8} value={v[k]} onInput={(e) => setV({ ...v, [k]: e.currentTarget.value })} />
          </label>
        ))}
      </div>
      <p class="small muted">{t("stockPostHelp")}</p>
      <button onClick={post} disabled={!ok || busy}>
        <ActionIcon name="save" />
        {busy ? t("sending") : t("stockPostBtn")}
      </button>
      {msg && <p class={msg.ok ? "ok" : "err"}>{msg.text}</p>}
    </div>
  )
}
