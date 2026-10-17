import { ActionIcon } from "./ActionIcon"
// Features grounded in documented PDS problems: issue tags, next steps
// (helpline, grievance letter, RTI), the "what is public" panel, settings (server, new ID, offline reader)
// and the evidence-file checker.
import { useEffect, useState } from "preact/hooks"
import { nextDelayed, sendWaitingNow, useQueueChanges, useQueueCount, useSendLater } from "./queue"
import { str } from "@arkiv-network/sdk/attr"
import { eq, or } from "@arkiv-network/sdk/query"
import {
  ISSUE_GROUPS,
  ISSUE_NAMES,
  ISSUES,
  issueList,
  parseReport,
  parseWitness,
  patternSignals,
  PROJECT,
  evidenceRows,
  SCHEME_ISSUES,
  schemeIssueList,
  schemeIssueNames,
  type Scheme,
  TIRAMISU_HTTP,
  TIRAMISU_WS,
  type IssueName,
  type RawEntity,
  type Report,
  type Witness,
} from "tolmol-sdk"
import { shopReports, shopWitnesses } from "./reads"
import { key as keyAttr } from "@arkiv-network/sdk/attr"
import { forgetThisPhone, newIdentity, reader, rpcSetting, setRpc } from "./arkiv"
import { usePrefs } from "./prefs"
import { useLang, type Key } from "./i18n"
import { ErrorBox } from "./ui"

const ICON: Record<string, string> = {
  // School meals and rural work
  poor_meal: "🍲",
  less_food: "🥄",
  menu_ignored: "📋",
  unsafe_kitchen: "🚰",
  seated_apart: "🚸",
  money_asked: "₹",
  children_work: "🧹",
  wage_late: "⏳",
  paid_less: "🧮",
  job_card_kept: "🪪",
  work_denied: "🚫",
  no_site_facilities: "⛱️",
  bribe_asked: "₹",
  fake_names: "📝",
  charged_money: "₹",
  auth_failed: "☝️",
  thumb_no_grain: "👍",
  shop_closed: "🔒",
  bad_quality: "🪨",
  portability_refused: "🧳",
  no_receipt: "🧾",
  slip_mismatch: "🧮",
  no_weighing: "⚖️",
  tied_sale: "🛒",
  card_kept: "🪪",
  no_board: "📋",
  told_lapsed: "📅",
  many_trips: "🔁",
  wrong_grain: "🌾",
  threatened: "⚠️",
  member_left_out: "👪",
}
const issueKey = (n: string) => `issue_${n}` as Key

/** Toggle buttons for "what else went wrong". `big` = Easy mode. */
export function IssuePicker({ value, onChange, big = false, only }: { value: number; onChange: (v: number) => void; big?: boolean; only?: IssueName[] }) {
  const { t } = useLang()
  const chip = (n: IssueName) => {
    const on = (value & ISSUES[n]) !== 0
    return (
      <button type="button" class={`${big ? "big-choice" : "chip"} ${on ? "selected" : ""}`} aria-pressed={on} onClick={() => onChange(value ^ ISSUES[n])}>
        <span class="icon" aria-hidden="true">{ICON[n]}</span> {on ? "✓ " : ""}
        {t(issueKey(n))}
      </button>
    )
  }
  // One group (Easy mode asks one question per screen), or all groups with their question as a heading (Full mode).
  if (only) return <div class={big ? "bigcol" : "issue-grid"}>{only.map(chip)}</div>
  return (
    <div class="issue-groups">
      {ISSUE_GROUPS.map((g) => (
        <fieldset class="plain issue-group">
          <legend>{t(`issueGroup_${g.id}` as Key)}</legend>
          <div class={big ? "bigcol" : "issue-grid"}>{g.issues.map(chip)}</div>
        </fieldset>
      ))}
    </div>
  )
}

export function IssueList({ mask, scheme = "pds" }: { mask: number; scheme?: Scheme }) {
  const { t } = useLang()
  const list = scheme === "pds" ? issueList(mask) : schemeIssueList(scheme, mask)
  if (!list.length) return null
  return (
    <ul class="issues">
      {list.map((n) => (
        <li>
          <span aria-hidden="true">{ICON[n]}</span> {t(issueKey(n))}
        </li>
      ))}
    </ul>
  )
}

/** Small per-shop summary: "₹ 5 · 🔒 2 …" for issues reported at least once. */
/** Issue counts: compact icons in lists, icon + words where there is room (phones have no hover tooltips). */
export function IssueCounts({ counts, labels = false, scheme = "pds" }: { counts: Record<string, number>; labels?: boolean; scheme?: Scheme }) {
  const { t } = useLang()
  const seen = (scheme === "pds" ? (ISSUE_NAMES as string[]) : schemeIssueNames(scheme)).filter((n) => (counts[n] ?? 0) > 0)
  if (!seen.length) return null
  if (labels) {
    return (
      <ul class="issues">
        {seen.map((n) => (
          <li>
            {ICON[n]} {t(issueKey(n))}: <strong>{counts[n]}</strong>
          </li>
        ))}
      </ul>
    )
  }
  return (
    <p class="small issue-counts">
      {seen.map((n) => (
        <span title={t(issueKey(n))} aria-label={`${t(issueKey(n))}: ${counts[n]}`}>
          {ICON[n]} {counts[n]}
        </span>
      ))}
    </p>
  )
}

/** "What you can do now": helpline, grievance officer letter, RTI, portability note. */
/**
 * State food departments' toll-free PDS grievance lines, as published on their own sites (checked 2026-10-16):
 * Bihar epos.bihar.gov.in, Uttar Pradesh fcs.up.gov.in, Jharkhand aahar.jharkhand.gov.in. 1967 is the national number.
 */
export const STATE_HELPLINES: Record<string, { tel: string; show: string }> = {
  BR: { tel: "18003456194", show: "1800-3456-194" },
  UP: { tel: "18001800150", show: "1800-1800-150" },
  JH: { tel: "18003456598", show: "1800-345-6598" },
}

export function NextSteps({ shopId, mask = 0, scheme = "pds" }: { shopId: string; mask?: number; scheme?: Scheme }) {
  const { t } = useLang()
  return (
    <section class="card next">
      <h3>{t("nextTitle")}</h3>
      <ol>
        {scheme === "pds" && <li>
          {t("nextHelpline")}{" "}
          <a class="button secondary" href="tel:1967">
            <ActionIcon name="phone" />{t("callHelpline")}
          </a>
          {STATE_HELPLINES[shopId.slice(4, 6)] && (
            <>
              {" "}
              <a class="button secondary" href={`tel:${STATE_HELPLINES[shopId.slice(4, 6)]!.tel}`}>
                <ActionIcon name="phone" />
                {t("callStateHelpline", { n: STATE_HELPLINES[shopId.slice(4, 6)]!.show })}
              </a>
            </>
          )}
        </li>}
        <li>
          {t("nextComplaint")}{" "}
          <a class="button secondary" href={`#/shop/${shopId}?letter=complaint`}>
            <ActionIcon name="letter" />{t("draftComplaint")}
          </a>
        </li>
        <li>
          {t("nextRti")}{" "}
          <a class="button secondary" href={`#/shop/${shopId}?letter=rti`}>
            <ActionIcon name="letter" />{t("openRti")}
          </a>
        </li>
        {scheme === "pds" && (mask & ISSUES.portability_refused) !== 0 && <li>{t("nextPortability")}</li>}
      </ol>
    </section>
  )
}

/** Shows exactly what Arkiv holds for one entity: every attribute name and value, and that the payload is empty. */
export function PrivacyPanel({ raw }: { raw: RawEntity }) {
  const { t } = useLang()
  const attrs = Object.entries(raw.attributes ?? {}).sort(([a], [b]) => (a < b ? -1 : 1))
  return (
    <section class="card">
      <h3>{t("privacyTitle")}</h3>
      <p class="small">{t("privacyHelp")}</p>
      <table class="tbl mono small">
        <tbody>
          {attrs.map(([name, v]) => (
            <tr>
              <td>{name}</td>
              <td>{v?.type}</td>
              <td>{String(v?.value)}</td>
            </tr>
          ))}
          <tr>
            <td>$creator</td>
            <td>addr</td>
            <td>{raw.creator}</td>
          </tr>
          <tr>
            <td>$owner</td>
            <td>addr</td>
            <td>{raw.owner}</td>
          </tr>
          <tr>
            <td>$payload</td>
            <td>bytes</td>
            <td>{raw.payload?.length ?? 0} bytes</td>
          </tr>
        </tbody>
      </table>
    </section>
  )
}

/** Full-mode settings: Arkiv server, new anonymous ID, offline reader. */
export function Settings() {
  const { t } = useLang()
  const [http, setHttp] = useState(rpcSetting.http ?? "")
  const [ws, setWs] = useState(rpcSetting.ws ?? "")
  const [confirmNewId, setConfirmNewId] = useState(false)
  const [confirmForget, setConfirmForget] = useState(false)
  const [prefs, setPrefs] = usePrefs()
  return (
    <section class="card">
      <h2>{t("settingsTitle")}</h2>
      <h3>{t("separateIdSetting")}</h3>
      <p class="small">{t("separateIdHelp")}</p>
      <label class="inline check">
        <input type="checkbox" checked={prefs.separateIds} onChange={(e) => setPrefs({ separateIds: e.currentTarget.checked })} /> {t("separateIdSetting")}
      </label>
      <h3>{t("rpcTitle")}</h3>
      <p class="small">{t("rpcHelp")}</p>
      <label>
        HTTP
        <input class="mono" placeholder={TIRAMISU_HTTP} value={http} onInput={(e) => setHttp(e.currentTarget.value.trim())} />
      </label>
      <label>
        WebSocket
        <input class="mono" placeholder={TIRAMISU_WS} value={ws} onInput={(e) => setWs(e.currentTarget.value.trim())} />
      </label>
      <div class="row wrap">
        <button onClick={() => setRpc(/^https?:\/\//.test(http) ? http : null, /^wss?:\/\//.test(ws) ? ws : null)}><ActionIcon name="save" />{t("save")}</button>
        <button class="secondary" onClick={() => setRpc(null, null)}>
          <ActionIcon name="refresh" />{t("resetDefault")}
        </button>
      </div>
      <h3>{t("newId")}</h3>
      <p class="small">{t("newIdHelp")}</p>
      {confirmNewId ? (
        <button onClick={newIdentity}><ActionIcon name="id" />{t("newId")}</button>
      ) : (
        <button class="secondary" onClick={() => setConfirmNewId(true)}>
          <ActionIcon name="id" />{t("newId")}
        </button>
      )}
      <h3>{t("forgetTitle")}</h3>
      <p class="small">{t("forgetHelp")}</p>
      {confirmForget ? (
        <div class="row wrap">
          <button onClick={() => void forgetThisPhone()}>
            <ActionIcon name="shield" />
            {t("forgetConfirm")}
          </button>
          <button class="secondary" onClick={() => setConfirmForget(false)}>
            {t("back")}
          </button>
        </div>
      ) : (
        <button class="secondary" onClick={() => setConfirmForget(true)}>
          <ActionIcon name="shield" />
          {t("forgetTitle")}
        </button>
      )}
      <h3>{t("mirrorLink")}</h3>
      <p class="small">{t("mirrorHelp")}</p>
      <a class="button secondary" href="mirror.html" download="tolmol-reader.html">
        <ActionIcon name="download" />tolmol-reader.html
      </a>{" "}
      <a href="mirror.html" target="_blank" rel="noopener">
        ↗
      </a>
    </section>
  )
}

// ------------------------------------------------------------------ evidence-file checker
type Row = { kind?: string; entity_key?: string; shop_id?: string; month?: string; entitled_g?: number | string; received_g?: number | string; creator?: string; report_key?: string }
type Check = { key: string; kind: string; status: "match" | "mismatch" | "missing"; why?: string }

const same = (a?: string, b?: string) => (a ?? "").toLowerCase() === (b ?? "").toLowerCase()

/** Re-reads every row of an exported evidence file from Arkiv and compares creator and values. */
export async function verifyRows(rows: Row[]): Promise<Check[]> {
  const keys = [...new Set(rows.map((r) => r.entity_key).filter((k): k is string => /^0x[0-9a-fA-F]{64}$/.test(k ?? "")))]
  const found = new Map<string, RawEntity>()
  // One query per 40 keys: $key = k1 OR $key = k2 ... (each arkiv_query costs the same, so batch them).
  for (let i = 0; i < keys.length; i += 40) {
    const chunk = keys.slice(i, i + 40)
    const page = await reader
      .select({ key: true, creator: true, owner: true, createdAt: true, expiresAt: true, attributes: true })
      .where(eq("project", str(PROJECT)), or(chunk.map((k) => eq("$key", keyAttr(k as `0x${string}`)))))
      .limit(200)
      .fetch()
    for (const e of page.entities) found.set((e.key as string).toLowerCase(), e as RawEntity)
  }
  return rows
    .filter((r) => r.entity_key)
    .map((r): Check => {
      const e = found.get(r.entity_key!.toLowerCase())
      const kind = r.kind ?? "?"
      if (!e) return { key: r.entity_key!, kind, status: "missing" }
      if (!same(e.creator, r.creator)) return { key: r.entity_key!, kind, status: "mismatch", why: "creator" }
      if (kind === "report") {
        const rep: Report | null = parseReport(e)
        if (!rep) return { key: r.entity_key!, kind, status: "mismatch", why: "not a valid report" }
        if (rep.shopId !== r.shop_id || rep.month !== r.month) return { key: r.entity_key!, kind, status: "mismatch", why: "shop/month" }
        if (rep.entitledG !== Number(r.entitled_g) || rep.receivedG !== Number(r.received_g)) return { key: r.entity_key!, kind, status: "mismatch", why: "quantities" }
      } else {
        const w = parseWitness(e)
        if (!w || !same(w.reportKey, r.report_key)) return { key: r.entity_key!, kind, status: "mismatch", why: "witness" }
      }
      return { key: r.entity_key!, kind, status: "match" }
    })
}

export function VerifyPage() {
  const { t } = useLang()
  const [checks, setChecks] = useState<Check[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<unknown>(null)
  const onFile = async (file: File | undefined) => {
    if (!file) return
    setErr(null)
    setChecks(null)
    setBusy(true)
    try {
      const data = JSON.parse(await file.text()) as { rows?: Row[] }
      if (!Array.isArray(data.rows)) throw new Error("This is not a Tolmol evidence file (no rows).")
      setChecks(await verifyRows(data.rows))
    } catch (e) {
      setErr(e)
    } finally {
      setBusy(false)
    }
  }
  // "Try tampering": a real export of the demo shop, with one number changed in this browser, checked against Arkiv.
  const [tampered, setTampered] = useState<string | null>(null)
  const tamperDemo = async () => {
    setErr(null)
    setChecks(null)
    setBusy(true)
    try {
      const [reps, wits] = await Promise.all([shopReports(reader, "SYN-BR-0042"), shopWitnesses(reader, "SYN-BR-0042")])
      const rows = evidenceRows(reps.items, wits.items, reps.atBlock).filter((r) => r.kind === "report").slice(0, 4)
      if (!rows.length) throw new Error("no rows")
      const victim = rows[rows.length - 1]!
      // The edit a dishonest copy would make: "they got more than they did".
      const forged = { ...victim, received_g: typeof victim.received_g === "number" ? Math.min(Number(victim.entitled_g), victim.received_g + 2000) : victim.received_g }
      setTampered(victim.entity_key)
      setChecks(await verifyRows([...rows.slice(0, -1), forged] as Row[]))
    } catch (e) {
      setErr(e)
    } finally {
      setBusy(false)
    }
  }
  const ok = checks?.filter((c) => c.status === "match").length ?? 0
  return (
    <section class="card">
      <h2>{t("verifyTitle")}</h2>
      <p>{t("verifyHelp")}</p>
      <input type="file" accept="application/json,.json" onChange={(e) => (setTampered(null), void onFile(e.currentTarget.files?.[0]))} />
      <p class="small">
        {t("tamperHelp")}{" "}
        <button class="secondary" onClick={() => void tamperDemo()} disabled={busy}>
          <ActionIcon name="check" />
          {t("tamperBtn")}
        </button>
      </p>
      {tampered && checks && <p class="small notice">{t("tamperNote", { key: tampered.slice(0, 10) })}</p>}
      {busy && <p class="muted">{t("loading")}</p>}
      {err ? <ErrorBox error={err} /> : null}
      {checks && (
        <>
          <p class={ok === checks.length ? "ok" : "err"}>
            <strong>{t("verifySummary", { ok, n: checks.length })}</strong>
          </p>
          <ul class="list">
            {checks.map((c) => (
              <li>
                <span class="mono small">{c.key.slice(0, 10)}…</span> · {c.kind} ·{" "}
                <span class={c.status === "match" ? "ok" : "err"}>
                  {c.status === "match" ? t("verifyMatch") : c.status === "missing" ? t("verifyMissing") : `${t("verifyMismatch")} (${c.why})`}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

// ------------------------------------------------------------------ public-data patterns (sybil / script signals)
/** Bursts and one-off devices at one shop, from public block numbers and $creator. Patterns, not proof. */
export function PatternsCard({ reports, witnesses, withdrawn }: { reports: Report[]; witnesses: Witness[]; withdrawn: ReadonlySet<string> }) {
  const { t } = useLang()
  const p = patternSignals(reports, witnesses, withdrawn)
  if (p.reports === 0) return null
  const quiet = p.rapidReports.length === 0 && p.rapidConfirmations.length === 0
  return (
    <section class="card patterns">
      <h3>{t("patternsTitle")}</h3>
      <ul>
        {p.rapidReports.map((g) => (
          <li class="warn-text">{t("patternsRapid", { count: g.count, devices: g.devices, from: g.fromBlock.toString(), to: g.toBlock.toString() })}</li>
        ))}
        {p.rapidConfirmations.map((g) => (
          <li class="warn-text">{t("patternsRapidConf", { count: g.count, devices: g.devices, from: g.fromBlock.toString(), to: g.toBlock.toString() })}</li>
        ))}
        {quiet && <li>{t("patternsNone")}</li>}
        {p.oneOffReports > 0 && <li>{t("patternsOneOff", { n: p.oneOffReports, total: p.reports })}</li>}
      </ul>
      <p class="small muted">{t("patternsFoot")}</p>
    </section>
  )
}

// ------------------------------------------------------------------ privacy: what becomes public, shown BEFORE sending
/** Issues after which a reporter may face retaliation: a separate ID is switched on for them by default. */
export const SENSITIVE_ISSUES = ISSUES.threatened | ISSUES.card_kept

/** Below this many different phones reporting a shop in a month, the dealer could guess who reported. */
export const FEW_REPORTERS = 3

/** How many different phones reported this shop this month (one query), for the small-shop warning. */
function useReporterCount(shopId?: string, month?: string) {
  const [n, setN] = useState<number | null>(null)
  useEffect(() => {
    if (!shopId || !month) return
    let live = true
    shopReports(reader, shopId, month)
      .then((r) => live && setN(new Set(r.items.map((x) => x.creator.toLowerCase())).size))
      .catch(() => live && setN(null))
    return () => {
      live = false
    }
  }, [shopId, month])
  return n
}

export function PublicPreview({ separateId, issues, scheme = "pds", sensitive, shopId, month }: { separateId: boolean; issues: number; scheme?: Scheme; sensitive?: boolean; shopId?: string; month?: string }) {
  const { t } = useLang()
  const risky = sensitive ?? (scheme === "pds" && (issues & SENSITIVE_ISSUES) !== 0)
  const pds = scheme === "pds"
  const others = useReporterCount(shopId, month)
  const few = others !== null && others < FEW_REPORTERS
  // Send at a random later time: only when the person ticks it. People open Tolmol about once a month, and a report
  // held for later goes out only when Tolmol is open, so it is never switched on by itself.
  const [later, setLater] = useSendLater()
  useEffect(() => () => setLater(false), [])
  return (
    <section class="public-preview" aria-labelledby="public-preview-title">
      <h3 id="public-preview-title">{t("previewTitle")}</h3>
      <div class="preview-cols">
        <div>
          <h4>{t("previewPublic")}</h4>
          <p class="small">{t(pds ? "previewPublicItems" : "previewPublicItemsScheme")}</p>
        </div>
        <div>
          <h4>{t("previewPrivate")}</h4>
          <p class="small">{t(pds ? "previewPrivateItems" : "previewPrivateItemsScheme")}</p>
        </div>
      </div>
      {pds && <p class="small muted">{t("previewFamily")}</p>}
      <p class="small">{separateId ? t("previewSeparate") : t("previewUsual")}</p>
      {separateId && risky && <p class="small notice">{t(pds ? "previewSensitive" : "previewSensitiveScheme")}</p>}
      {few && <p class="small notice">{t("previewFewReporters", { n: others ?? 0 })}</p>}
      <label class="inline check">
        <input type="checkbox" checked={later} onChange={(e) => setLater(e.currentTarget.checked)} /> {t("sendLaterLabel")}
      </label>
      <p class={later ? "small notice" : "small muted"}>{t("sendLaterHelp")}</p>
      <p class="small muted">{t("previewNoEncrypt")}</p>
    </section>
  )
}

/** Toggle buttons for one scheme's issues (school meals, rural work). Ration keeps IssuePicker above. */
export function SchemeIssuePicker({ scheme, value, onChange, only, big = true }: { scheme: Scheme; value: number; onChange: (v: number) => void; only: string[]; big?: boolean }) {
  const { t } = useLang()
  const bits = SCHEME_ISSUES[scheme]
  return (
    <div class={big ? "bigcol" : "issue-grid"}>
      {only.map((n) => {
        const bit = bits[n] ?? 0
        const on = (value & bit) !== 0
        return (
          <button type="button" class={`${big ? "big-choice" : "chip"} ${on ? "selected" : ""}`} aria-pressed={on} onClick={() => onChange(value ^ bit)}>
            <span class="icon" aria-hidden="true">{ICON[n]}</span> {on ? "✓ " : ""}
            {t(issueKey(n))}
          </button>
        )
      })}
    </div>
  )
}

/** After saving offline or with "send later": what will happen, in plain words, and "Send now" for a held report. */
export function QueuedNote() {
  const { t } = useLang()
  const waiting = useQueueCount()
  useQueueChanges() // re-renders when the report is released or goes out
  const at = nextDelayed()
  if (waiting === 0) return <>{t("queueAllSent")}</>
  if (!at) return <>{t(navigator.onLine ? "queueSending" : "queued")}</>
  const time = new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  return (
    <>
      {t("queuedLater", { time })}{" "}
      <button type="button" class="linkish" onClick={sendWaitingNow}>
        {t("sendNow")}
      </button>
    </>
  )
}
