// Verified card holders (simple version, TEST cards): who is verified, the ✓ badge, and the two screens to try it.
// Everything is read from Arkiv in the browser: verifiers named by the registry, attestations by those verifiers.
import qrcode from "qrcode-generator"
import { useEffect, useState } from "preact/hooks"
import { ActionIcon } from "./ActionIcon"
import {
  decodeCard,
  deviceProofMessage,
  listAttestations,
  listVerifiers,
  verifiedDealers,
  verifiedDevices,
  verifiedOfficials,
  type Attestation,
  type TestCard,
  type Verifier,
} from "tolmol-sdk"
import { device, reader, RELAYER_URL } from "./arkiv"
import { STATE_NAMES, useLang } from "./i18n"

// ------------------------------------------------------------------ who is verified (cached per page load)
let verifiersP: Promise<Verifier[]> | null = null
let attP: Promise<Attestation[]> | null = null

function load(fresh: boolean) {
  if (fresh) attP = null
  verifiersP ??= listVerifiers(reader).then((r) => r.items)
  attP ??= listAttestations(reader).then((r) => r.items)
  const both = Promise.all([verifiersP, attP])
  both.catch(() => {
    verifiersP = null
    attP = null
  })
  return both
}
/** lower-cased device -> attestation, for every verified card holder. Two queries for the whole app. */
export const loadVerified = (fresh = false) => load(fresh).then(([vs, as]) => verifiedDevices(vs, as))
/** lower-cased device -> attestation, for every verified shop dealer (its shopId is the shop it answers for). */
export const loadDealers = (fresh = false) => load(fresh).then(([vs, as]) => verifiedDealers(vs, as))
/** lower-cased device -> attestation, for every verified official (jurisdiction: the district of its shop). */
export const loadOfficials = (fresh = false) => load(fresh).then(([vs, as]) => verifiedOfficials(vs, as))

function useLoaded(f: () => Promise<Map<string, Attestation>>): Map<string, Attestation> | null {
  const [m, setM] = useState<Map<string, Attestation> | null>(null)
  useEffect(() => {
    let live = true
    f().then((x) => live && setM(x), () => live && setM(new Map()))
    return () => {
      live = false
    }
  }, [])
  return m
}
export const useVerified = () => useLoaded(() => loadVerified())
export const useDealers = () => useLoaded(() => loadDealers())
export const useOfficials = () => useLoaded(() => loadOfficials())

export function VerifiedBadge({ a }: { a: Attestation | undefined }) {
  const { t } = useLang()
  if (!a) return null
  return (
    <span class="tag ok-tag" title={t("verifiedBadgeTitle", { shop: a.shopId })}>
      {t("verifiedBadge")}
    </span>
  )
}

// ------------------------------------------------------------------ ask the verifier
export async function verifyThisPhone(cardText: string, card: TestCard): Promise<{ ok: boolean; already?: boolean; error?: string }> {
  if (!RELAYER_URL) return { ok: false, error: "NO_RELAYER" }
  const { account } = device()
  const sig = await account.signMessage({ message: deviceProofMessage(card.serial, account.address) })
  try {
    const res = await fetch(`${RELAYER_URL.replace(/\/$/, "")}/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ card: cardText, device: account.address, sig }),
    })
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; already?: boolean; error?: string }
    return res.ok ? { ok: true, already: body.already } : { ok: false, error: body.error ?? `HTTP ${res.status}` }
  } catch (e) {
    return { ok: false, error: String((e as Error).message ?? e) }
  }
}

/** One line for the device card: verified, or a link to get verified. */
export function PhoneVerification() {
  const { t } = useLang()
  const m = useVerified()
  const dealers = useDealers()
  const officials = useOfficials()
  const me = device().account.address.toLowerCase()
  const a = m?.get(me)
  const d = dealers?.get(me)
  const o = officials?.get(me)
  if (!m || !dealers || !officials) return null
  if (o) return <p class="small ok">{t("phoneIsOfficial", { shop: o.shopId })} <a href={`#/dashboard?state=${o.state}`}>⚖ →</a></p>
  if (d) return <p class="small ok">{t("phoneIsDealer", { shop: d.shopId })} <a href={`#/shop/${d.shopId}`}>{d.shopId} →</a></p>
  return a ? (
    <p class="small ok">{t("phoneVerified", { shop: a.shopId })}</p>
  ) : (
    <p class="small">
      <a href="#/test-cards">{t("verifyPhoneLink")} →</a>
    </p>
  )
}

// ------------------------------------------------------------------ #/card?c=… : verify this phone with one card
export function CardPage({ c }: { c: string }) {
  const { t, lang } = useLang()
  const card = decodeCard(c)
  const [state, setState] = useState<"idle" | "busy" | "done" | "already" | "used" | "failed">("idle")
  if (!card) return <p class="error" role="alert">{t("cardInvalid")}</p>
  const go = async () => {
    setState("busy")
    const r = await verifyThisPhone(c, card)
    if (r.ok) {
      await load(true).catch(() => undefined)
      setState(r.already ? "already" : "done")
    } else setState(r.error === "card_used" ? "used" : "failed")
  }
  const isDealer = card.type === "FPS"
  const isOfficial = card.type === "GOV"
  return (
    <section class="card">
      <h2>{t(isOfficial ? "officialIdTitle" : isDealer ? "dealerLicenceTitle" : "cardTitle")}</h2>
      <p class="notice small">{isOfficial ? t("officialIdHelp", { shop: card.shopId }) : isDealer ? t("dealerLicenceHelp", { shop: card.shopId }) : t("cardSynthetic")}</p>
      <dl class="facts">
        <dt>{t("state")}</dt>
        <dd>{STATE_NAMES[card.state]?.[lang] ?? card.state}</dd>
        <dt>{t("shop")}</dt>
        <dd class="mono">{card.shopId}</dd>
        <dt>{t("cardTypeLabel")}</dt>
        <dd>{isOfficial ? t("officialIdTitle") : isDealer ? t("dealerLicenceTitle") : t(card.type === "AAY" ? "cardType_AAY" : "cardType_PHH")}</dd>
      </dl>
      <p class="small">{t("verifyPrivacy", { shop: card.shopId })}</p>
      {state === "done" || state === "already" ? (
        <p class="ok" role="status">
          {isOfficial && state === "done" ? t("officialDone", { shop: card.shopId }) : isDealer && state === "done" ? t("dealerDone", { shop: card.shopId }) : t(state === "done" ? "verifyDone" : "verifyAlready")}{" "}
          <a href={isDealer || isOfficial ? `#/shop/${card.shopId}` : `#/report?shop=${card.shopId}`}>{isDealer || isOfficial ? card.shopId : t("ctaReport")} →</a>
        </p>
      ) : (
        <button class="big-action" onClick={go} disabled={state === "busy"}>
          <ActionIcon name="card" />
          {state === "busy" ? t("verifying") : t(isOfficial ? "verifyAsOfficial" : isDealer ? "verifyAsDealer" : "verifyWithCard")}
        </button>
      )}
      {state === "used" && <p class="error" role="alert">{t("verifyUsed")} <a href="#/test-cards">{t("testCardsTitle")}</a></p>}
      {state === "failed" && <p class="error" role="alert">{t("verifyFailed")}</p>}
    </section>
  )
}

// ------------------------------------------------------------------ #/test-cards : the synthetic cards to try it with
function Qr({ url }: { url: string }) {
  const qr = qrcode(0, "L")
  qr.addData(url)
  qr.make()
  return <div class="qr small-qr" role="img" aria-label="QR" dangerouslySetInnerHTML={{ __html: qr.createSvgTag({ cellSize: 3, margin: 2, scalable: true }) }} />
}

export function TestCardsPage() {
  const { t } = useLang()
  const [cards, setCards] = useState<{ text: string; card: TestCard }[] | null>(null)
  const [dealers, setDealers] = useState<{ text: string; card: TestCard }[]>([])
  const [officials, setOfficials] = useState<{ text: string; card: TestCard }[]>([])
  const [err, setErr] = useState(false)
  useEffect(() => {
    fetch("test-cards.json")
      .then((r) => r.json() as Promise<{ cards: string[]; dealers?: string[]; officials?: string[] }>)
      .then((j) => {
        const dec = (list: string[]) => list.flatMap((text) => {
          const card = decodeCard(text)
          return card ? [{ text, card }] : []
        })
        setCards(dec(j.cards))
        setDealers(dec(j.dealers ?? []))
        setOfficials(dec(j.officials ?? []))
      })
      .catch(() => setErr(true))
  }, [])
  const base = `${location.origin}${location.pathname}`
  return (
    <section class="card">
      <h2>{t("testCardsTitle")}</h2>
      <p class="small">{t("testCardsHelp")}</p>
      <PhoneVerification />
      {err && <p class="error">{t("errGeneric")}</p>}
      <ul class="cards">
        {cards?.map(({ text, card }, i) => (
          <li>
            <Qr url={`${base}#/card?c=${text}`} />
            <div>
              <strong>#{i + 1}</strong> <span class="mono small">{card.shopId}</span> · {card.type}
              <br />
              <a class="button secondary" href={`#/card?c=${text}`}>
                <ActionIcon name="card" />{t("useCard")}
              </a>
            </div>
          </li>
        ))}
      </ul>
      {dealers.length > 0 && (
        <>
          <h3>{t("testDealersTitle")}</h3>
          <p class="small">{t("testDealersHelp")}</p>
          <ul class="cards">
            {dealers.map(({ text, card }, i) => (
              <li>
                <Qr url={`${base}#/card?c=${text}`} />
                <div>
                  <strong>D{i + 1}</strong> <span class="mono small">{card.shopId}</span> · {t("dealerLicenceTitle")}
                  <br />
                  <a class="button secondary" href={`#/card?c=${text}`}>
                  <ActionIcon name="card" />{t("useCard")}
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {officials.length > 0 && (
        <>
          <h3>{t("testOfficialsTitle")}</h3>
          <p class="small">{t("testOfficialsHelp")}</p>
          <ul class="cards">
            {officials.map(({ text, card }, i) => (
              <li>
                <Qr url={`${base}#/card?c=${text}`} />
                <div>
                  <strong>G{i + 1}</strong> <span class="mono small">{card.shopId}</span> · {t("officialIdTitle")}
                  <br />
                  <a class="button secondary" href={`#/card?c=${text}`}>
                  <ActionIcon name="card" />{t("useCard")}
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
