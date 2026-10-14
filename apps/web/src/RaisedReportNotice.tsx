import { useEffect, useRef } from "preact/hooks"
import { ActionIcon } from "./ActionIcon"
import { useLang } from "./i18n"
import { ReferencePhoto } from "./ReferencePhotos"
import { SuccessSeal } from "./ui"

/** Rendered only after a saved report; this is not an acknowledgement from a government portal. */
export function RaisedReportNotice({ reportKey, shopId }: { reportKey: string; shopId: string }) {
  const { t } = useLang()
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    heading.current?.scrollIntoView({ behavior: "instant", block: "start" })
  }, [])
  return <div class="report-raised-notice">
    <div class="report-raised-copy">
      <div role="status"><h2 ref={heading} tabIndex={-1} class="success-heading raised-heading"><SuccessSeal />{t("reportRaisedTitle")}</h2><p>{t("reportRaisedSaved")}</p></div>
      <p class="report-reference"><span>{t("reportReference")}</span><a class="mono" href={`#/r/${reportKey}`}>{reportKey.slice(0, 12)}…{reportKey.slice(-8)} <span aria-hidden="true">↗</span></a></p>
      <div class="official-followup"><h3><ActionIcon name="people" />{t("reportRaisedOfficialsTitle")}</h3><p>{t("reportRaisedOfficials")}</p></div>
      <div class="raised-actions"><a class="button" href={`#/shop/${shopId}`}><ActionIcon name="shop" />{t("followShopUpdates")}</a><a class="button secondary" href={`#/shop/${shopId}?letter=complaint`}><ActionIcon name="letter" />{t("draftComplaint")}</a></div>
      <p class="small muted complaint-submission-note">{t("reportRaisedFormal")}</p>
    </div>
    <ReferencePhoto kind="community" />
  </div>
}
