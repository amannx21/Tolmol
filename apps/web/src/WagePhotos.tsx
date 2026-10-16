import { ActionIcon } from "./ActionIcon"
import { useLang } from "./i18n"
import { useReveal } from "./motion"

const images = {
  scheme: {
    name: "nrega-scheme", height: 540,
    source: "https://www.studyiq.com/articles/mahatma-gandhi-national-rural-employment-guarantee-scheme/",
    credit: "StudyIQ",
    en: "MGNREGA scheme graphic with Mahatma Gandhi’s portrait and the scheme name",
    hi: "महात्मा गांधी के चित्र और मनरेगा के नाम वाला योजना परिचय चित्र",
  },
  workers: {
    name: "nrega-workers", height: 672,
    source: "https://www.shutterstock.com/image-generated/mgnrega-2622134373",
    credit: "Shutterstock AI · Preview",
    en: "Illustration of women and men with shovels and baskets working in green fields beneath an MGNREGA banner",
    hi: "मनरेगा के बैनर के नीचे हरे खेतों में फावड़े और टोकरियों के साथ काम करती महिलाओं और पुरुषों का चित्र",
  },
}

function WagePhoto({ kind, priority = false }: { kind: keyof typeof images; priority?: boolean }) {
  const { lang } = useLang()
  const hi = lang === "hi"
  const photo = images[kind]
  return <figure class={`reference-photo wage-photo wage-photo-${kind}`}>
    <img src={`images/${photo.name}-960.webp`} srcSet={`images/${photo.name}-640.webp 640w, images/${photo.name}-960.webp 960w`} sizes="(max-width: 720px) calc(100vw - 64px), 500px" width="960" height={photo.height} loading={priority ? "eager" : "lazy"} decoding="async" alt={hi ? photo.hi : photo.en} />
    <figcaption><span>{hi ? "मनरेगा का प्रतिनिधि चित्र" : "Representative MGNREGA illustration"}</span><a href={photo.source} target="_blank" rel="noopener">{photo.credit} ↗</a></figcaption>
  </figure>
}

export function WageHero() {
  const { t } = useLang()
  return <div class="wage-hero-art">
    <WagePhoto kind="workers" priority />
    <p class="wage-hero-caption">{t("homeVisual_nrega")}</p>
  </div>
}

export function WageStory() {
  const { lang } = useLang()
  const hi = lang === "hi"
  const root = useReveal()
  return <div ref={root} class="distribution-story wage-story"><section class="photo-band" data-reveal aria-labelledby="wage-story-title">
    <WagePhoto kind="scheme" />
    <div class="photo-band-copy">
      <span class="eyebrow">{hi ? "आपका काम। आपकी मज़दूरी।" : "YOUR WORK. YOUR WAGES."}</span>
      <h2 id="wage-story-title">{hi ? "मेहनत का हिसाब, सबके सामने।" : "A clear record of your hard work."}</h2>
      <p>{hi ? "कितने दिन काम किया, कितनी मज़दूरी मिलनी थी और कितनी मिली—यहाँ दर्ज करें। आपकी पंचायत के दूसरे मज़दूर भी पुष्टि कर सकते हैं।" : "Record your days worked, the wages you expected and the amount you received. Other workers in your panchayat can add their confirmation."}</p>
      <div class="photo-story-points">
        <span><ActionIcon name="calendar" />{hi ? "काम के दिन" : "Days worked"}</span>
        <span><ActionIcon name="people" />{hi ? "मज़दूरों की पुष्टि" : "Workers’ confirmations"}</span>
        <span><ActionIcon name="report" />{hi ? "पंचायत का रिकॉर्ड" : "Panchayat records"}</span>
      </div>
    </div>
  </section></div>
}
