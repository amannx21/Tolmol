// Features added after reviewing documented PDS problems and other entries: issue tags, next steps
// (helpline, grievance letter, RTI), the "what is public" panel, settings (server, new ID, offline reader)
// and the evidence-file checker.
import { useState } from "preact/hooks"
import { str } from "@arkiv-network/sdk/attr"
import { eq, or } from "@arkiv-network/sdk/query"
import {
  ISSUE_NAMES,
  ISSUES,
  issueList,
  parseReport,
  parseWitness,
  PROJECT,
  TIRAMISU_HTTP,
  TIRAMISU_WS,
  type IssueName,
  type RawEntity,
  type Report,
} from "tolmol-sdk"
import { key as keyAttr } from "@arkiv-network/sdk/attr"
import { newIdentity, reader, rpcSetting, setRpc } from "./arkiv"
import { useLang, type Key } from "./i18n"
import { ErrorBox } from "./ui"

const ICON: Record<IssueName, string> = {
  charged_money: "₹",
  auth_failed: "☝️",
  thumb_no_grain: "👍",
  shop_closed: "🔒",
  bad_quality: "🪨",
  portability_refused: "🧳",
  no_receipt: "🧾",
}
const issueKey = (n: IssueName) => `issue_${n}` as Key

/** Toggle buttons for "what else went wrong". `big` = Easy mode. */
export function IssuePicker({ value, onChange, big = false }: { value: number; onChange: (v: number) => void; big?: boolean }) {
  const { t } = useLang()
  return (
    <div class={big ? "bigcol" : "issue-grid"}>
      {ISSUE_NAMES.map((n) => {
        const on = (value & ISSUES[n]) !== 0
        return (
          <button type="button" class={`${big ? "big-choice" : "chip"} ${on ? "selected" : ""}`} aria-pressed={on} onClick={() => onChange(value ^ ISSUES[n])}>
            <span class="icon" aria-hidden="true">{ICON[n]}</span> {on ? "✓ " : ""}
            {t(issueKey(n))}
          </button>
        )
      })}
    </div>
  )
}

export function IssueList({ mask }: { mask: number }) {
  const { t } = useLang()
  const list = issueList(mask)
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
export function IssueCounts({ counts }: { counts: Record<IssueName, number> }) {
  const { t } = useLang()
  const seen = ISSUE_NAMES.filter((n) => counts[n] > 0)
  if (!seen.length) return null
  return (
    <p class="small issue-counts">
      {seen.map((n) => (
        <span title={t(issueKey(n))}>
          {ICON[n]} {counts[n]}
        </span>
      ))}
    </p>
  )
}

/** "What you can do now": helpline, grievance officer letter, RTI, portability note. */
export function NextSteps({ shopId, mask = 0 }: { shopId: string; mask?: number }) {
  const { t } = useLang()
  return (
    <section class="card next">
      <h3>{t("nextTitle")}</h3>
      <ol>
        <li>
          {t("nextHelpline")}{" "}
          <a class="button secondary" href="tel:1967">
            📞 {t("callHelpline")}
          </a>
        </li>
        <li>
          {t("nextComplaint")}{" "}
          <a class="button secondary" href={`#/shop/${shopId}?letter=complaint`}>
            {t("draftComplaint")}
          </a>
        </li>
        <li>
          {t("nextRti")}{" "}
          <a class="button secondary" href={`#/shop/${shopId}?letter=rti`}>
            {t("openRti")}
          </a>
        </li>
        {(mask & ISSUES.portability_refused) !== 0 && <li>{t("nextPortability")}</li>}
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
  return (
    <section class="card">
      <h2>{t("settingsTitle")}</h2>
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
        <button onClick={() => setRpc(/^https?:\/\//.test(http) ? http : null, /^wss?:\/\//.test(ws) ? ws : null)}>{t("save")}</button>
        <button class="secondary" onClick={() => setRpc(null, null)}>
          {t("resetDefault")}
        </button>
      </div>
      <h3>{t("newId")}</h3>
      <p class="small">{t("newIdHelp")}</p>
      {confirmNewId ? (
        <button onClick={newIdentity}>✓ {t("newId")}</button>
      ) : (
        <button class="secondary" onClick={() => setConfirmNewId(true)}>
          {t("newId")}
        </button>
      )}
      <h3>{t("mirrorLink")}</h3>
      <p class="small">{t("mirrorHelp")}</p>
      <a class="button secondary" href="mirror.html" download="tolmol-reader.html">
        ⬇ tolmol-reader.html
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
  const ok = checks?.filter((c) => c.status === "match").length ?? 0
  return (
    <section class="card">
      <h2>{t("verifyTitle")}</h2>
      <p>{t("verifyHelp")}</p>
      <input type="file" accept="application/json,.json" onChange={(e) => void onFile(e.currentTarget.files?.[0])} />
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
