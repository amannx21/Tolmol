// Private notes to the district official (tolmol-sdk notes.ts). The reporter writes on their own report; the phone
// encrypts it so that only the verified official of that district can read it, and seals it on Arkiv. The official
// turns notes on once, then reads them on the outlet's page. Everyone else, on the explorer, sees ciphertext.
import { useEffect, useState } from "preact/hooks"
import {
  decryptNote,
  districtOfficeKeys,
  explorerEntityUrl,
  NOTE_MAX_CHARS,
  publishOfficeKey,
  reportNotes,
  sendNote,
  shopNotesTo,
  validNotes,
  validOfficeKeys,
  type OfficeKey,
  type Report,
} from "tolmol-sdk"
import { ActionIcon } from "./ActionIcon"
import { device, devicePrivateKey, ensureGas, reader, short, writerForAddress } from "./arkiv"
import { useFmt, useLang } from "./i18n"
import { useShopDistricts } from "./officialUI"
import { useOfficials } from "./verified"

/** On the reporter's own report: write a private note that only the district's official can read. */
export function ReporterNote({ report }: { report: Report }) {
  const { t } = useLang()
  const f = useFmt()
  const officials = useOfficials()
  const districts = useShopDistricts()
  // undefined: loading; null: no official of this district has turned notes on; "error": could not check right now.
  const [office, setOffice] = useState<OfficeKey | null | "error" | undefined>(undefined)
  const [sent, setSent] = useState(0)
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string; link?: string } | null>(null)
  const load = async () => {
    if (!officials || !districts) return
    const [keys, notes] = await Promise.all([districtOfficeKeys(reader, report.district), reportNotes(reader, report.key)])
    setOffice(validOfficeKeys(keys.items, officials, districts).get(report.district)?.[0] ?? null)
    setSent(validNotes(notes.items, new Map([[report.key.toLowerCase(), report]])).length)
  }
  useEffect(() => {
    void load().catch(() => setOffice("error"))
  }, [report.key, officials, districts])
  if (office === undefined) return null
  const send = async () => {
    const w = writerForAddress(report.creator)
    if (!office || office === "error" || !w) return
    setBusy(true)
    setMsg(null)
    try {
      if (!(await ensureGas(w.account.address))) return setMsg({ ok: false, text: t("gasFailed") })
      const res = await sendNote(reader, w, report, office, text, { synthetic: true })
      setText("")
      setMsg({ ok: true, text: t("noteSent", { district: f.district(report.district) }), link: explorerEntityUrl(res.entityKey) })
      await load()
    } catch {
      setMsg({ ok: false, text: t("errGeneric") })
    } finally {
      setBusy(false)
    }
  }
  return (
    <section class="card private-note">
      <h3>
        <ActionIcon name="shield" />
        {t("noteTitle")}
      </h3>
      {office === "error" ? (
        <p class="muted">{t("noteCantCheck")}</p>
      ) : !office ? (
        <p class="muted">{t("noteNoKey", { district: f.district(report.district) })}</p>
      ) : (
        <>
          <p class="small">{t("noteHelp", { district: f.district(report.district) })}</p>
          <textarea rows={4} maxLength={NOTE_MAX_CHARS} value={text} placeholder={t("notePlaceholder")} onInput={(e) => setText(e.currentTarget.value)} aria-label={t("noteTitle")} />
          <div class="row wrap">
            <button onClick={() => void send()} disabled={busy || !text.trim()}>
              <ActionIcon name="shield" />
              {busy ? t("noteSending") : t("noteSend")}
            </button>
            <span class="small muted">
              {[...text].length}/{NOTE_MAX_CHARS}
            </span>
          </div>
        </>
      )}
      {sent > 0 && <p class="small">{t("noteSentCount", { n: sent })}</p>}
      {msg && (
        <p class={msg.ok ? "ok" : "err"} role={msg.ok ? "status" : "alert"}>
          {msg.text}{" "}
          {msg.link && (
            <a href={msg.link} target="_blank" rel="noopener">
              {t("noteExplorer")} ↗
            </a>
          )}
        </p>
      )}
    </section>
  )
}

/** For the outlet's district official: turn private notes on once, then read the notes about this outlet. */
export function OfficialNotes({ shop, reports }: { shop: { shopId: string; state: string; district: string }; reports?: readonly Report[] }) {
  const { t } = useLang()
  const f = useFmt()
  const officials = useOfficials()
  const districts = useShopDistricts()
  const me = device().account.address.toLowerCase()
  const [mine, setMine] = useState<boolean | null>(null)
  const [notes, setNotes] = useState<{ key: string; reportKey: string; text: string | null; block: bigint }[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(false)
  const load = async () => {
    if (!officials || !districts) return
    const keys = await districtOfficeKeys(reader, shop.district)
    const on = (validOfficeKeys(keys.items, officials, districts).get(shop.district) ?? []).some((k) => k.creator.toLowerCase() === me)
    setMine(on)
    if (!on) return
    const pk = devicePrivateKey()
    const found = await shopNotesTo(reader, shop.shopId, me)
    const byKey = new Map((reports ?? []).map((r) => [r.key.toLowerCase(), r]))
    setNotes(
      validNotes(found.items, byKey).map((n) => {
        let text: string | null = null
        try {
          text = pk ? decryptNote(n.envelope, pk, n.reportKey, n.to) : null
        } catch {
          text = null
        }
        return { key: n.key, reportKey: n.reportKey, text, block: n.createdAt }
      }),
    )
  }
  useEffect(() => {
    void load().catch(() => setErr(true))
  }, [shop.shopId, officials, districts])
  const turnOn = async () => {
    const pk = devicePrivateKey()
    if (!pk) return setErr(true)
    setBusy(true)
    try {
      if (!(await ensureGas())) return setErr(true)
      await publishOfficeKey(device().writer, pk, shop, { synthetic: true })
      await load()
    } catch {
      setErr(true)
    } finally {
      setBusy(false)
    }
  }
  if (mine === null) return err ? <p class="small muted">{t("noteCantCheck")}</p> : null
  return (
    <div class="official-notes">
      <h4>
        <ActionIcon name="shield" />
        {t("offNotesTitle")}
      </h4>
      {!mine ? (
        <>
          <p class="small muted">{t("offNotesOnHelp", { district: f.district(shop.district) })}</p>
          <button class="secondary" onClick={() => void turnOn()} disabled={busy}>
            <ActionIcon name="shield" />
            {t("offNotesOn")}
          </button>
        </>
      ) : !notes ? null : notes.length === 0 ? (
        <p class="small muted">{t("offNotesNone")}</p>
      ) : (
        <ul class="list">
          {notes.map((n) => (
            <li>
              {n.text !== null ? <blockquote class="note-text">{n.text}</blockquote> : <span class="muted">{t("offNotesCant")}</span>}
              <span class="small muted">
                <a href={`#/r/${n.reportKey}`}>{short(n.reportKey)}</a> · #{n.block.toString()} ·{" "}
                <a href={explorerEntityUrl(n.key)} target="_blank" rel="noopener">
                  {t("noteExplorer")} ↗
                </a>
              </span>
            </li>
          ))}
        </ul>
      )}
      {err && <p class="err">{t("errGeneric")}</p>}
    </div>
  )
}
