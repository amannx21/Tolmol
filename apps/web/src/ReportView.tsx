import { useEffect, useState } from "preact/hooks"
import {
  BURN_ADDRESS,
  corroborate,
  daysLeft,
  DuplicateError,
  explorerAddressUrl,
  formatBp,
  parseReport,
  reportCorrections,
  reportWitnesses,
  withdrawReport,
  type RawEntity,
  SelfWitnessError,
  validWitnesses,
  type Report,
  type Witness,
} from "tolmol-sdk"
import { device, ensureGas, myAddresses, reader, short, writerForAddress } from "./arkiv"
import { Say } from "./Easy"
import { usePrefs } from "./prefs"
import { useFmt, useLang } from "./i18n"
import { IssueList, NextSteps, PrivacyPanel } from "./extras"
import { DeviceCard, ErrorBox, Explorer, Loading } from "./ui"

export function ReportView({ reportKey }: { reportKey: `0x${string}` }) {
  const { t } = useLang()
  const [prefs] = usePrefs()
  const f = useFmt()
  const kg = f.kg
  const [data, setData] = useState<{ report: Report | null; raw: RawEntity | null; witnesses: Witness[]; withdrawnBy: boolean; head: bigint } | null>(null)
  const [confirmWithdraw, setConfirmWithdraw] = useState(false)
  const [err, setErr] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const isNew = location.hash.includes("new=1")
  const me = device().account.address

  const load = async () => {
    try {
      const head = await reader.getBlockNumber({ cacheTime: 0 })
      // One read gives both the validated report and the raw entity for the "what is public" panel.
      const raw = (await reader.getEntity(reportKey).catch(() => null)) as RawEntity | null
      const report = raw ? parseReport(raw) : null
      const [witnesses, corrections] = report
        ? await Promise.all([reportWitnesses(reader, reportKey, { atBlock: head }), reportCorrections(reader, reportKey, { atBlock: head })])
        : [{ items: [] as Witness[] }, { items: [] }]
      // A withdrawal counts only if the report's own creator filed it.
      const withdrawnBy = !!report && corrections.items.some((c) => c.creator.toLowerCase() === report.creator.toLowerCase())
      setData({ report, raw, witnesses: witnesses.items, withdrawnBy, head })
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
  // Mine if any ID on this phone wrote it: the current one, a retired one, or a separate per-report ID.
  const mine = myAddresses().has(r.creator.toLowerCase())
  const separate = mine && r.creator.toLowerCase() !== me.toLowerCase()
  const iWitnessed = data.witnesses.some((w) => w.creator.toLowerCase() === me.toLowerCase())
  const link = `${location.origin}${location.pathname}#/r/${r.key}`

  const withdraw = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const writer = writerForAddress(r.creator)
      if (!writer || !(await ensureGas(writer.account.address))) {
        setMsg({ ok: false, text: t("gasFailed") })
        return
      }
      await withdrawReport(reader, writer, r.key, { synthetic: true })
      setMsg({ ok: true, text: t("withdrawDone") })
      setConfirmWithdraw(false)
      await load()
    } catch {
      setMsg({ ok: false, text: t("errGeneric") })
    } finally {
      setBusy(false)
    }
  }

  const withdrawBox =
    mine && !data.withdrawnBy ? (
      <div class="withdraw">
        {confirmWithdraw ? (
          <>
            <p class="small">{t("withdrawConfirm")}</p>
            <button class="secondary" onClick={withdraw} disabled={busy}>
              {t("withdrawYes")}
            </button>
          </>
        ) : (
          <button class="link-back" onClick={() => setConfirmWithdraw(true)}>
            {t("withdraw")}
          </button>
        )}
      </div>
    ) : null

  const confirm = async () => {
    setBusy(true)
    setMsg(null)
    try {
      await corroborate(reader, device().writer, r.key, { synthetic: true })
      setMsg({ ok: true, text: t("corroborated") })
      await load()
    } catch (e) {
      const text =
        e instanceof SelfWitnessError ? t("ownReport") : e instanceof DuplicateError ? t("alreadyWitnessed") : t("errGeneric")
      setMsg({ ok: false, text })
    } finally {
      setBusy(false)
    }
  }

  const fullView = (
    <>
      <section class="card">
        <h2>{t("reportTitle")}</h2>
        {data.withdrawnBy && <p class="tag big-tag">{t("withdrawn")}</p>}
        <p>
          <a href={`#/shop/${r.shopId}?month=${r.month}`}>{r.shopId}</a> · {f.month(r.month)} · {t(r.item)}
        </p>
        <dl class="facts">
          <dt>{t("entitledKg")}</dt>
          <dd>{kg(r.entitledG)}</dd>
          <dt>{t("receivedKg")}</dt>
          <dd>{kg(r.receivedG)}</dd>
          <dt>{t("shortfall")}</dt>
          <dd>
            <strong>
              {kg(r.shortfallG)} ({formatBp(r.shortfallBp)})
            </strong>
          </dd>
          <dt>{t("reporter")}</dt>
          <dd>
            <a class="mono" href={explorerAddressUrl(r.creator)} target="_blank" rel="noopener">
              {short(r.creator)}
            </a>
            {mine && ` (${t("you")}${separate ? ` · ${t("separateIdShort")}` : ""})`}
          </dd>
          <dt>{t("createdBlock")}</dt>
          <dd class="mono">{r.createdAt.toString()}</dd>
          <dt>{t("expires")}</dt>
          <dd>
            {daysLeft(r.expiresAt, data.head)} {t("days")}
            {!r.extendable && <span class="small muted"> · {t("notExtendable")}</span>}
          </dd>
          <dt>Arkiv</dt>
          <dd>
            <Explorer k={r.key} />
            {r.owner.toLowerCase() === BURN_ADDRESS.toLowerCase() && <span class="small muted"> · {t("undeletable")}</span>}
          </dd>
        </dl>
        <IssueList mask={r.issues} />
        {withdrawBox}
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
      {data.raw && <PrivacyPanel raw={data.raw} />}
    </>
  )

  if (prefs.mode === "full") {
    return (
      <>
      {isNew && (
        <section class="card success" role="status">
          <h2>✓ {t("sent")}</h2>
          <p class="small">{t("shareForWitness")}</p>
          <input class="mono share" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
          {"share" in navigator && (
            <button class="secondary" onClick={() => void navigator.share({ url: link, title: "Tolmol" }).catch(() => {})}>
              {t("share")}
            </button>
          )}
        </section>
      )}
        {fullView}
        {mine && <NextSteps shopId={r.shopId} mask={r.issues} />}
      </>
    )
  }

  // Easy mode: the claim in big numbers, how many others confirmed it, and one big button.
  const summary = `${t("summaryShould")} ${kg(r.entitledG)}. ${t("summaryGot")} ${kg(r.receivedG)}. ${t("summaryLess")} ${kg(r.shortfallG)}.`
  const confirmEasy = async () => {
    setBusy(true)
    setMsg(null)
    if (!(await ensureGas())) {
      setMsg({ ok: false, text: t("gasFailed") })
      setBusy(false)
      return
    }
    await confirm()
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
              {t("share")}
            </button>
          )}
        </section>
      )}
      <section class="card easy">
        <h2>
          {r.shopId} · {f.month(r.month)} · {t(r.item)}
        </h2>
        <Say text={summary} />
        <div class="summary">
          <div><span>{t("summaryShould")}</span><strong>{kg(r.entitledG)}</strong></div>
          <div><span>{t("summaryGot")}</span><strong>{kg(r.receivedG)}</strong></div>
          <div class={r.shortfallG > 0 ? "bad" : "ok"}><span>{t("summaryLess")}</span><strong>{kg(r.shortfallG)}</strong></div>
        </div>
        {data.withdrawnBy && <p class="tag big-tag">{t("withdrawn")}</p>}
        <IssueList mask={r.issues} />
        <p class="lead">{t("confirmedBy", { n: valid.length })}</p>
        {!mine && !iWitnessed && (
          <button class="big-action" onClick={confirmEasy} disabled={busy}>
            {busy ? t("corroborating") : t("confirmEasy")}
          </button>
        )}
        {mine && <p class="small muted">{t("ownReport")}</p>}
        {withdrawBox}
        {msg && <p class={msg.ok ? "ok" : "err"}>{msg.text}</p>}
      </section>
      {mine && <NextSteps shopId={r.shopId} mask={r.issues} />}
      <details class="card auditors">
        <summary>{t("detailsAuditors")}</summary>
        {fullView}
      </details>
    </>
  )
}
