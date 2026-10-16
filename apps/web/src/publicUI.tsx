// #/public: what a stranger sees. A real report and a real private note, exactly as anyone can read them from Arkiv
// (the same data the block explorer shows), next to everything that never left the reporter's phone, and the result of
// the daily public audit that checks every Tolmol entity against the data contract.
import { useEffect, useState } from "preact/hooks"
import { str } from "@arkiv-network/sdk/attr"
import { eq } from "@arkiv-network/sdk/query"
import { explorerEntityUrl, NOTE_TYPE, PROJECT, type RawEntity } from "tolmol-sdk"
import { shopReports } from "./reads"
import { reader } from "./arkiv"
import { useLang, type Key } from "./i18n"
import { ErrorBox, Loading } from "./ui"

const AUDIT_API = "https://api.github.com/repos/amannx21/Tolmol/actions/workflows/data-check.yml/runs?per_page=1"
const NEVER: Key[] = ["pubNever1", "pubNever2", "pubNever3", "pubNever4", "pubNever5", "pubNever6"]

function RawTable({ raw }: { raw: RawEntity }) {
  const attrs = Object.entries(raw.attributes ?? {}).sort(([a], [b]) => (a < b ? -1 : 1))
  const payload = raw.payload ?? new Uint8Array()
  return (
    <table class="tbl mono small public-raw">
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
          <td>{payload.length === 0 ? "0 bytes (empty)" : `${payload.length} bytes: ${new TextDecoder().decode(payload).slice(0, 160)}…`}</td>
        </tr>
      </tbody>
    </table>
  )
}

export function PublicViewPage() {
  const { t } = useLang()
  const [report, setReport] = useState<RawEntity | null | undefined>(undefined)
  const [note, setNote] = useState<RawEntity | null | undefined>(undefined)
  const [audit, setAudit] = useState<{ conclusion: string | null; at: string; url: string } | null | undefined>(undefined)
  const [err, setErr] = useState<unknown>(null)
  useEffect(() => {
    shopReports(reader, "SYN-BR-0042")
      .then(async (rs) => {
        const latest = [...rs.items].sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))[0]
        setReport(latest ? ((await reader.getEntity(latest.key)) as RawEntity) : null)
      })
      .catch(setErr)
    reader
      .select({ key: true })
      .where([eq("project", str(PROJECT)), eq("type", str(NOTE_TYPE))])
      .limit(1)
      .fetch()
      .then(async (page) => {
        const k = page.entities[0]?.key
        setNote(k ? ((await reader.getEntity(k)) as RawEntity) : null)
      })
      .catch(() => setNote(null))
    fetch(AUDIT_API)
      .then((r) => r.json() as Promise<{ workflow_runs?: { conclusion: string | null; updated_at: string; html_url: string }[] }>)
      .then((j) => {
        const run = j.workflow_runs?.[0]
        setAudit(run ? { conclusion: run.conclusion, at: run.updated_at, url: run.html_url } : null)
      })
      .catch(() => setAudit(null))
  }, [])
  if (err) return <ErrorBox error={err} />
  return (
    <>
      <section class="card">
        <h2>{t("pubTitle")}</h2>
        <p class="small">{t("pubHelp")}</p>
      </section>
      <div class="public-grid">
        <section class="card">
          <h3>{t("pubReportTitle")}</h3>
          {report === undefined ? <Loading /> : report ? (
            <>
              <RawTable raw={report} />
              <p class="small">
                <a href={explorerEntityUrl(report.key!)} target="_blank" rel="noopener">{t("pubOnExplorer")} ↗</a> · <a href={`#/r/${report.key}`}>{t("pubInApp")}</a>
              </p>
            </>
          ) : <p class="muted">—</p>}
        </section>
        <section class="card public-never">
          <h3>{t("pubNeverTitle")}</h3>
          <ul>
            {NEVER.map((k) => (
              <li>✕ {t(k)}</li>
            ))}
          </ul>
          <p class="small muted">{t("pubNeverFoot")}</p>
        </section>
      </div>
      <section class="card">
        <h3>{t("pubNoteTitle")}</h3>
        <p class="small">{t("pubNoteHelp")}</p>
        {note === undefined ? <Loading /> : note ? (
          <>
            <RawTable raw={note} />
            <p class="small">
              <a href={explorerEntityUrl(note.key!)} target="_blank" rel="noopener">{t("pubOnExplorer")} ↗</a>
            </p>
          </>
        ) : <p class="muted">{t("pubNoNote")}</p>}
      </section>
      <section class="card">
        <h3>{t("pubAuditTitle")}</h3>
        {audit === undefined ? <Loading /> : audit ? (
          <p>
            <span class={`tag ${audit.conclusion === "success" ? "ok-tag" : "warn"}`}>{audit.conclusion === "success" ? "PASS" : (audit.conclusion ?? "running")}</span>{" "}
            {t("pubAuditLast", { at: new Date(audit.at).toLocaleString() })} ·{" "}
            <a href={audit.url} target="_blank" rel="noopener">{t("pubAuditLink")} ↗</a>
          </p>
        ) : <p class="muted">{t("pubAuditNone")}</p>}
        <p class="small">{t("pubAuditHow")}</p>
        <pre class="mono small">node --import tsx scripts/privacy-audit.ts</pre>
      </section>
    </>
  )
}
