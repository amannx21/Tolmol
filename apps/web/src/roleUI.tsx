// One site for everyone: the same pages for card holders, dealers, officials and visitors, with the right buttons
// appearing for each verified role (roles come from attestations on Arkiv, so nobody can fake them). Also the
// "My activity" page and the "See how it works" tour. Built on the redesign's flow-section / tool-card styles.
import { useEffect, useState } from "preact/hooks"
import { key as keyAttr, str } from "@arkiv-network/sdk/attr"
import { eq, or } from "@arkiv-network/sdk/query"
import {
  dedupeReports,
  formatBp,
  latestFollowups,
  myReports,
  parseCorrection,
  parseFollowup,
  parseResponse,
  parseWitness,
  PROJECT,
  shopReports,
  shopResponses,
  TYPE,
  ANSWER_TYPE,
  validResponses,
  validWitnesses,
  withdrawnKeys,
  type Correction,
  type Followup,
  type RawEntity,
  type Report,
  type Response,
  type Witness,
} from "tolmol-sdk"
import { CheckShop } from "./checkUI"
import { loadOutlets } from "./ui"
import { ActionIcon, type ActionIconName } from "./ActionIcon"
import { device, myAddresses, reader } from "./arkiv"
import { outletKey, useFmt, useLang, type Key } from "./i18n"
import { ErrorBox, Loading } from "./ui"
import { PhoneVerification, useDealers, useOfficials, useVerified } from "./verified"

type Card = { icon: ActionIconName; title: string; body: string; action: string; href: string; strong?: boolean }

function ToolCards({ cards }: { cards: Card[] }) {
  return (
    <div class="tool-grid">
      {cards.map((c) => (
        <article class={`tool-card ${c.strong ? "role-card" : ""}`} key={c.href + c.title}>
          <span class="feature-icon">
            <ActionIcon name={c.icon} />
          </span>
          <div>
            <h3>{c.title}</h3>
            <p>{c.body}</p>
            <a class="inline-action" href={c.href}>
              {c.action}
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </article>
      ))}
    </div>
  )
}

/** "What you can do here": everyone's tools, plus the cards for this phone's verified role. Same in Easy and Full. */
export function RoleHub({ scheme = "pds" }: { scheme?: "pds" | "mdm" | "nrega" } = {}) {
  const { t } = useLang()
  const holders = useVerified()
  const dealers = useDealers()
  const officials = useOfficials()
  const me = device().account.address.toLowerCase()
  const holder = holders?.get(me)
  const dealer = dealers?.get(me)
  const official = officials?.get(me)
  const [waiting, setWaiting] = useState<number | null>(null)
  // Which kind of outlet this phone answers for (shop, school or panchayat), for the card's wording.
  const [dealerScheme, setDealerScheme] = useState<"pds" | "mdm" | "nrega">("pds")
  useEffect(() => {
    if (dealer) void loadOutlets().then((all) => setDealerScheme(all.find((s) => s.shopId === dealer.shopId)?.scheme ?? "pds"), () => undefined)
  }, [dealer?.shopId])
  useEffect(() => {
    if (!dealer || !dealers) return
    let live = true
    Promise.all([shopReports(reader, dealer.shopId), shopResponses(reader, dealer.shopId)])
      .then(([rs, as]) => {
        const counted = dedupeReports(rs.items).filter((r) => r.shortfallG > 0)
        const answered = validResponses(counted, as.items, dealers)
        if (live) setWaiting(counted.filter((r) => !answered.has(r.key.toLowerCase())).length)
      })
      .catch(() => live && setWaiting(null))
    return () => {
      live = false
    }
  }, [dealer?.shopId, dealers])

  const roleCard: Card | null = dealer
    ? { icon: "shop", title: t(outletKey("roleDealerTitle", dealerScheme), { shop: dealer.shopId }), body: waiting === null ? t(outletKey("roleDealerBody", dealerScheme)) : t("roleDealerWaiting", { n: waiting }), action: t(outletKey("roleDealerAction", dealerScheme)), href: "#/my-outlet", strong: true }
    : official
      ? { icon: "shield", title: t("roleOfficialTitle", { shop: official.shopId }), body: t("roleOfficialBody"), action: t("roleOfficialAction"), href: `#/dashboard?state=${official.state}`, strong: true }
      : holder
        ? { icon: "card", title: t("roleHolderTitle", { shop: holder.shopId }), body: t("roleHolderBody"), action: t("navMe"), href: "#/me", strong: true }
        : null
  const everyone: Card[] = [
    { icon: "report", title: t("hubReportTitle"), body: t("hubReportBody"), action: t("ctaReport"), href: "#/report" },
    { icon: "id", title: t("navMe"), body: t("hubMeBody"), action: t("hubMeAction"), href: "#/me" },
    { icon: "dashboard", title: t("hubShopsTitle"), body: t("hubShopsBody"), action: t("seeAllShops"), href: "#/dashboard" },
    { icon: "check", title: t("verifyTitle"), body: t("hubCheckBody"), action: t("hubCheckAction"), href: "#/verify" },
    ...(roleCard ? [] : [{ icon: "shield" as const, title: t("navGetVerified"), body: t("hubVerifyBody"), action: t("hubVerifyAction"), href: "#/test-cards" }]),
    { icon: "next", title: t("tourTitle"), body: t("hubTourBody"), action: t("hubTourAction"), href: "#/tour" },
    // Add-ons on the same ledger (ration stays the main topic).
    ...(scheme === "pds" ? [{ icon: "people" as const, title: t("hubAddOnsTitle"), body: t("hubAddOnsBody"), action: t("hubAddOnsAction"), href: "#/schemes" }] : []),
  ]
  return (
    <>
    <CheckShop scheme={scheme} />
    <section class="flow-section role-hub" aria-labelledby="role-title">
      <div class="section-heading">
        <div>
          <span class="eyebrow">{t("roleEyebrow")}</span>
          <h2 id="role-title">{t("roleTitle")}</h2>
        </div>
        <span class="section-note">{t("roleNote")}</span>
      </div>
      <ToolCards cards={roleCard ? [roleCard, ...everyone] : everyone} />
    </section>
    </>
  )
}

// ------------------------------------------------------------------ #/me : my activity
const LIMIT = 40
async function byReportKeys<T>(type: string, keys: string[], parse: (e: RawEntity) => T | null): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < keys.length; i += LIMIT) {
    const chunk = keys.slice(i, i + LIMIT)
    const page = await reader
      .select({ key: true, creator: true, owner: true, createdAt: true, expiresAt: true, attributes: true })
      .where([eq("project", str(PROJECT)), eq("type", str(type)), or(chunk.map((k) => eq("report_key", keyAttr(k as `0x${string}`))))])
      .limit(200)
      .fetch()
    for (const e of page.entities) {
      const x = parse(e as RawEntity)
      if (x) out.push(x)
    }
  }
  return out
}

type Activity = {
  reports: Report[]
  witnesses: Witness[]
  answers: Map<string, Response[]>
  followups: Map<string, Followup>
  withdrawn: Set<string>
  confirmedByMe: Witness[]
}

export function MyActivityPage() {
  const { t } = useLang()
  const f = useFmt()
  const dealers = useDealers()
  const [data, setData] = useState<Activity | null>(null)
  const [err, setErr] = useState<unknown>(null)
  useEffect(() => {
    if (!dealers) return
    let live = true
    ;(async () => {
      // Every ID this phone holds (current, retired, separate per-report IDs): one query each.
      const addrs = [...myAddresses()]
      const reports = (await Promise.all(addrs.map((a) => myReports(reader, a as `0x${string}`)))).flatMap((r) => r.items)
      const keys = reports.map((r) => r.key.toLowerCase())
      const [witnesses, responses, followups, corrections, mine] = await Promise.all([
        byReportKeys(TYPE.witness, keys, parseWitness),
        byReportKeys(ANSWER_TYPE.response, keys, parseResponse),
        byReportKeys(ANSWER_TYPE.followup, keys, parseFollowup),
        byReportKeys(TYPE.correction, keys, parseCorrection),
        reader
          .select({ key: true, creator: true, owner: true, createdAt: true, expiresAt: true, attributes: true })
          .where([eq("project", str(PROJECT)), eq("type", str(TYPE.witness))])
          .createdBy(device().account.address)
          .limit(200)
          .fetch()
          .then((p) => p.entities.map((e) => parseWitness(e as RawEntity)).filter((x): x is Witness => !!x)),
      ])
      if (!live) return
      setData({
        reports: [...reports].sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1)),
        witnesses,
        answers: validResponses(reports, responses, dealers),
        followups: latestFollowups(reports, followups),
        withdrawn: withdrawnKeys(reports, corrections as Correction[]),
        confirmedByMe: mine,
      })
    })().catch((e) => live && setErr(e))
    return () => {
      live = false
    }
  }, [dealers])

  if (err) return <ErrorBox error={err} />
  return (
    <>
      <section class="card">
        <h2>{t("navMe")}</h2>
        <p class="small muted">{t("meHelp")}</p>
        <PhoneVerification />
      </section>
      {!data ? (
        <Loading />
      ) : (
        <>
          <section class="card">
            <h3>{t("meReports", { n: data.reports.length })}</h3>
            {data.reports.length === 0 ? (
              <p class="muted">
                {t("meNoReports")}{" "}
                <a href="#/report">
                  <ActionIcon name="report" />
                  {t("ctaReport")}
                </a>
              </p>
            ) : (
              <ul class="list me-reports">
                {data.reports.map((r) => {
                  const k = r.key.toLowerCase()
                  const answers = data.answers.get(k) ?? []
                  const fu = data.followups.get(k)
                  const confirmed = validWitnesses(r, data.witnesses).length
                  return (
                    <li>
                      <a href={`#/r/${r.key}`}>
                        <strong>{r.shopId}</strong> · {f.month(r.month)} · {t(r.item as Key)} · {f.amt(r.item, r.shortfallG)} ({formatBp(r.shortfallBp)})
                      </a>
                      <div class="small">
                        {data.withdrawn.has(k) ? (
                          <span class="tag">{t("withdrawn")}</span>
                        ) : (
                          <>
                            <span class="tag">{t("confirmedBy", { n: confirmed })}</span>
                            <span class={`tag ${answers.length ? "ok-tag" : ""}`}>{answers.length ? t("meAnswered") : t("noShopAnswer")}</span>
                            {fu && <span class={`tag ${fu.status === "fixed" ? "ok-tag" : "warn"}`}>{t(fu.status === "fixed" ? "youSaidFixed" : "youSaidNotFixed")}</span>}
                            {answers.length > 0 && !fu && <span class="tag warn">{t("meTellUs")}</span>}
                          </>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
          <section class="card">
            <h3>{t("meConfirmed", { n: data.confirmedByMe.length })}</h3>
            <ul class="list">
              {data.confirmedByMe.map((w) => (
                <li>
                  <a href={`#/r/${w.reportKey}`}>
                    {w.shopId} · {f.month(w.month)} · {t(w.item as Key)}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  )
}

// ------------------------------------------------------------------ #/tour : see how it works
const DEMO = "SYN-BR-0042"
export function TourPage() {
  const { t } = useLang()
  const [answered, setAnswered] = useState<string | null>(null)
  useEffect(() => {
    shopResponses(reader, DEMO)
      .then((r) => setAnswered(r.items[0]?.reportKey ?? null))
      .catch(() => setAnswered(null))
  }, [])
  const steps: Card[] = [
    { icon: "dashboard", title: t("tour1Title"), body: t("tour1Body"), action: t("tourOpen"), href: "#/dashboard?state=BR" },
    { icon: "shop", title: t("tour2Title"), body: t("tour2Body"), action: t("tourOpen"), href: `#/shop/${DEMO}` },
    { icon: "people", title: t("tour3Title"), body: t("tour3Body"), action: t("tourOpen"), href: answered ? `#/r/${answered}` : `#/shop/${DEMO}` },
    { icon: "report", title: t("tour4Title"), body: t("tour4Body"), action: t("ctaReport"), href: "#/report" },
    { icon: "shield", title: t("tour5Title"), body: t("tour5Body"), action: t("tourOpen"), href: "#/test-cards" },
    { icon: "check", title: t("tour6Title"), body: t("tour6Body"), action: t("tourOpen"), href: "mirror.html" },
  ]
  return (
    <section class="flow-section tour" aria-labelledby="tour-title">
      <div class="section-heading">
        <div>
          <span class="eyebrow">{t("tourEyebrow")}</span>
          <h2 id="tour-title">{t("tourTitle")}</h2>
        </div>
        <span class="section-note">{t("tourNote")}</span>
      </div>
      <div class="journey-grid">
        {steps.map((s, i) => (
          <article class="journey-card" key={s.title}>
            <div class="journey-top">
              <span class="feature-icon">
                <ActionIcon name={s.icon} />
              </span>
              <span class="step-number">0{i + 1}</span>
            </div>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
            <a class="inline-action" href={s.href}>
              {s.action}
              <span aria-hidden="true">↗</span>
            </a>
          </article>
        ))}
      </div>
    </section>
  )
}
