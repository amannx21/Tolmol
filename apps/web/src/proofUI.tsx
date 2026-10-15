// The hearing kit on a reporter's own report, and the #/proof page an official opens to check "this report is mine".
import { useMemo, useState } from "preact/hooks"
import qrcode from "qrcode-generator"
import type { LocalAccount } from "viem"
import { checkProof, decodeProof, encodeProof, makeProof, proofCode, PROOF_MAX_AGE_S, type ProofCheck, type Report } from "tolmol-sdk"
import { ActionIcon } from "./ActionIcon"
import { reader, short, writerForAddress } from "./arkiv"
import { useFmt, useLang } from "./i18n"

function Qr({ text }: { text: string }) {
  const svg = useMemo(() => {
    const qr = qrcode(0, "L")
    qr.addData(text)
    qr.make()
    return qr.createSvgTag({ cellSize: 3, margin: 2, scalable: true })
  }, [text])
  return <div class="qr" role="img" aria-label="QR" dangerouslySetInnerHTML={{ __html: svg }} />
}

/** On the reporter's own report: everything to take to a grievance hearing, including a private proof of authorship. */
export function HearingKit({ report }: { report: Report }) {
  const { t } = useLang()
  const [code, setCode] = useState("")
  const [proof, setProof] = useState<string | null>(null)
  const [err, setErr] = useState(false)
  const base = `${location.origin}${location.pathname}`
  const prove = async () => {
    setErr(false)
    const w = writerForAddress(report.creator)
    if (!w) return setErr(true)
    try {
      setProof(encodeProof(await makeProof(w.account as LocalAccount, report.key, code.trim())))
    } catch {
      setErr(true)
    }
  }
  return (
    <section class="card hearing-kit">
      <h3>{t("hearingTitle")}</h3>
      <p class="small">{t("hearingHelp")}</p>
      <ol>
        <li>
          <a class="button secondary" href={`#/shop/${report.shopId}?letter=complaint`}>
            <ActionIcon name="letter" />
            {t("draftComplaint")}
          </a>
        </li>
        <li>
          <a class="button secondary" href={`#/shop/${report.shopId}?month=${report.month}`}>
            <ActionIcon name="download" />
            {t("hearingEvidence")}
          </a>
        </li>
        <li>
          <p class="small">{t("proofHelp")}</p>
          <div class="row wrap">
            <input class="mono" inputMode="numeric" maxLength={6} size={8} placeholder="123456" value={code} onInput={(e) => setCode(e.currentTarget.value)} aria-label={t("proofCodeLabel")} />
            <button onClick={prove} disabled={!/^\d{6}$/.test(code.trim())}>
              <ActionIcon name="shield" />
              {t("proofMake")}
            </button>
          </div>
          {err && <p class="err">{t("proofNoKey")}</p>}
          {proof && (
            <div class="row wrap">
              <Qr text={`${base}#/proof?p=${proof}`} />
              <p class="small">
                {t("proofShow")}
                <br />
                <code class="mono small proof-text">{proof}</code>
              </p>
            </div>
          )}
        </li>
      </ol>
    </section>
  )
}

const PENDING = "tolmol.proofcode.v1"
function pendingCode(): { code: string; at: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(PENDING) ?? "null") as { code: string; at: number } | null
    return v && Date.now() - v.at < PROOF_MAX_AGE_S * 1000 ? v : null
  } catch {
    return null
  }
}

/** #/proof: the official's side. Issue a one-time code, then check the proof the person shows. */
export function ProofPage({ p }: { p?: string }) {
  const { t } = useLang()
  const f = useFmt()
  const [code, setCode] = useState(() => pendingCode()?.code ?? null)
  const [text, setText] = useState(p ?? "")
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<ProofCheck | "invalid" | null>(null)
  const issue = () => {
    const c = proofCode()
    try {
      localStorage.setItem(PENDING, JSON.stringify({ code: c, at: Date.now() }))
    } catch {
      /* the code is still shown; matching just will not be automatic */
    }
    setCode(c)
    setRes(null)
  }
  const check = async () => {
    const proof = decodeProof(text.replace(/^.*[?&]p=/, ""))
    if (!proof) return setRes("invalid")
    setBusy(true)
    try {
      setRes(await checkProof(reader, proof, { expectCode: code ?? undefined }))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section class="card">
      <h2>{t("proofPageTitle")}</h2>
      <p class="small">{t("proofPageHelp")}</p>
      <h3>1. {t("proofStep1")}</h3>
      {code ? (
        <p class="proof-code mono" aria-live="polite">
          {code}
        </p>
      ) : null}
      <button class="secondary" onClick={issue}>
        <ActionIcon name="refresh" />
        {t("proofIssue")}
      </button>
      <h3>2. {t("proofStep2")}</h3>
      <textarea class="mono" rows={3} value={text} onInput={(e) => setText(e.currentTarget.value)} aria-label={t("proofStep2")} />
      <button onClick={check} disabled={busy || !text.trim()}>
        <ActionIcon name="check" />
        {busy ? t("loading") : t("proofCheck")}
      </button>
      {res === "invalid" && <p class="err">{t("proofInvalid")}</p>}
      {res && res !== "invalid" && !res.ok && <p class="err">{t(res.reason === "not_creator" ? "proofNotCreator" : res.reason === "no_report" ? "proofNoReport" : "proofInvalid")}</p>}
      {res && res !== "invalid" && res.ok && (
        <div class={`verdict ${res.fresh && res.codeMatches !== false ? "verdict-green" : "verdict-amber"}`} role="status">
          <p class="verdict-line">
            ✓ <strong>{t("proofOk")}</strong>
          </p>
          <p class="small">
            <a href={`#/r/${res.report.key}`}>{res.report.shopId} · {f.month(res.report.month)} · {short(res.report.key)}</a> · {t("proofSigner")} <span class="mono">{short(res.signer)}</span>
          </p>
          {!res.fresh && <p class="small notice">{t("proofOld")}</p>}
          {res.codeMatches === false && <p class="small notice">{t("proofWrongCode")}</p>}
          <p class="small muted">{t("proofNothingPublic")}</p>
        </div>
      )}
    </section>
  )
}
