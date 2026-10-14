import { useEffect, useState } from "preact/hooks"
import {
  BURN_ADDRESS,
  corroborate,
  daysLeft,
  DuplicateError,
  explorerAddressUrl,
  formatBp,
  formatKg,
  getReport,
  reportWitnesses,
  SelfWitnessError,
  validWitnesses,
  type Report,
  type Witness,
} from "tolmol-sdk"
import { device, reader, short } from "./arkiv"
import { useLang } from "./i18n"
import { DeviceCard, ErrorBox, Explorer, Loading } from "./ui"

export function ReportView({ reportKey }: { reportKey: `0x${string}` }) {
  const { t } = useLang()
  const [data, setData] = useState<{ report: Report | null; witnesses: Witness[]; head: bigint } | null>(null)
  const [err, setErr] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const isNew = location.hash.includes("new=1")
  const me = device().account.address

  const load = async () => {
    try {
      const head = await reader.getBlockNumber({ cacheTime: 0 })
      const report = await getReport(reader, reportKey)
      const witnesses = report ? (await reportWitnesses(reader, reportKey, { atBlock: head })).items : []
      setData({ report, witnesses, head })
    } catch (e) {
      setErr(e)
    }
  }
  useEffect(() => {
    void load()
  }, [reportKey])

  if (err) return <ErrorBox error={err} />
  if (!data) return <Loading />
  const r = data.report
  if (!r) return <p class="err">{t("notFound")}</p>

  const valid = validWitnesses(r, data.witnesses)
  const validKeys = new Set(valid.map((w) => w.key.toLowerCase()))
  const mine = r.creator.toLowerCase() === me.toLowerCase()
  const iWitnessed = data.witnesses.some((w) => w.creator.toLowerCase() === me.toLowerCase())
  const link = `${location.origin}${location.pathname}#/r/${r.key}`

  const confirm = async () => {
    setBusy(true)
    setMsg(null)
    try {
      await corroborate(reader, device().writer, r.key, { synthetic: true })
      setMsg({ ok: true, text: t("corroborated") })
      await load()
    } catch (e) {
      const text =
        e instanceof SelfWitnessError ? t("ownReport") : e instanceof DuplicateError ? t("alreadyWitnessed") : String((e as Error).message).split("\n")[0]!
      setMsg({ ok: false, text })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {isNew && (
        <section class="card success" role="status">
          <h2>✓ {t("sent")}</h2>
          <p class="small">{t("shareForWitness")}</p>
          <input class="mono share" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
          {"share" in navigator && (
            <button class="secondary" onClick={() => void navigator.share({ url: link, title: "Tolmol" }).catch(() => {})}>
              Share
            </button>
          )}
        </section>
      )}
      <section class="card">
        <h2>{t("reportTitle")}</h2>
        <p>
          <a href={`#/shop/${r.shopId}?month=${r.month}`}>{r.shopId}</a> · {r.month} · {t(r.item)}
        </p>
        <dl class="facts">
          <dt>{t("entitledKg")}</dt>
          <dd>{formatKg(r.entitledG)}</dd>
          <dt>{t("receivedKg")}</dt>
          <dd>{formatKg(r.receivedG)}</dd>
          <dt>{t("shortfall")}</dt>
          <dd>
            <strong>
              {formatKg(r.shortfallG)} ({formatBp(r.shortfallBp)})
            </strong>
          </dd>
          <dt>{t("reporter")}</dt>
          <dd>
            <a class="mono" href={explorerAddressUrl(r.creator)} target="_blank" rel="noopener">
              {short(r.creator)}
            </a>
            {mine && ` (${t("you")})`}
          </dd>
          <dt>{t("createdBlock")}</dt>
          <dd class="mono">{r.createdAt.toString()}</dd>
          <dt>{t("expires")}</dt>
          <dd>
            {daysLeft(r.expiresAt, data.head)} {t("days")}
          </dd>
          <dt>Arkiv</dt>
          <dd>
            <Explorer k={r.key} />
            {r.owner.toLowerCase() === BURN_ADDRESS.toLowerCase() && <span class="small muted"> · owner 0x…dEaD (undeletable)</span>}
          </dd>
        </dl>
      </section>
      <section class="card">
        <h3>
          {t("witnesses")}: {valid.length}
        </h3>
        {data.witnesses.length === 0 && <p class="muted">{t("noWitnesses")}</p>}
        <ul class="list">
          {data.witnesses.map((w) => (
            <li>
              <a class="mono" href={explorerAddressUrl(w.creator)} target="_blank" rel="noopener">
                {short(w.creator)}
              </a>{" "}
              · <span class="mono small">#{w.createdAt.toString()}</span> · <Explorer k={w.key} />
              {!validKeys.has(w.key.toLowerCase()) && (
                <span class="tag">{w.creator.toLowerCase() === r.creator.toLowerCase() ? t("selfWitnessIgnored") : t("duplicateIgnored")}</span>
              )}
            </li>
          ))}
        </ul>
        {!mine && !iWitnessed && (
          <>
            <DeviceCard compact />
            <button onClick={confirm} disabled={busy}>
              {busy ? t("corroborating") : t("corroborate")}
            </button>
          </>
        )}
        {mine && <p class="small muted">{t("ownReport")}</p>}
        {msg && <p class={msg.ok ? "ok" : "err"}>{msg.text}</p>}
      </section>
    </>
  )
}
