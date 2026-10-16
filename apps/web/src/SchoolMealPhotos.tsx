import { ActionIcon } from "./ActionIcon"
import { useLang } from "./i18n"
import { useReveal } from "./motion"

const illustrations = {
  classroom: {
    name: "school-meal-classroom", height: 540,
    source: "https://gfm.akshayakalpa.org/read/feature-article/midday-meals-scheme-in-indian-schools-nutrition-learning-limitations-cost-cutting-infrastructure",
    credit: "Good Food Movement",
    en: "Illustration of children in blue school uniforms sharing a cooked meal in a classroom",
    hi: "कक्षा में साथ बैठकर गरम पका भोजन खाते नीली वर्दी में स्कूली बच्चों का चित्र",
  },
  serving: {
    name: "school-meal-serving", height: 720,
    source: "https://www.newindianexpress.com/states/kerala/2025/Jul/07/mid-day-meals-feeling-the-bite-of-fund-crunch-kerala-government-to-turn-to-lsgs",
    credit: "The New Indian Express",
    en: "Illustration of a hand ladling curry onto a plate of rice with side dishes",
    hi: "चावल और दूसरी चीज़ों से भरी थाली में कलछी से गरम भोजन परोसते हाथ का चित्र",
  },
  child: {
    name: "school-meal-child", height: 503,
    source: "https://commons.wikimedia.org/wiki/File:MDM_scheme.jpg",
    credit: "Myadam Abhilash / Wikimedia Commons · CC0",
    en: "Photo of schoolchildren in uniform sitting along the walls of a government school room, eating their mid-day meal from steel plates",
    hi: "सरकारी स्कूल के कमरे में दीवार के साथ बैठकर स्टील की थालियों में मिड-डे मील खाते वर्दी पहने बच्चों की फ़ोटो",
  },
}

export function SchoolMealPhoto({ kind, priority = false }: { kind: keyof typeof illustrations; priority?: boolean }) {
  const { lang } = useLang()
  const hi = lang === "hi"
  const photo = illustrations[kind]
  const width = kind === "child" ? 600 : 960
  return <figure class={`reference-photo meal-photo meal-photo-${kind}`}>
    <img src={`images/${photo.name}-${width}.webp`} srcSet={kind === "child" ? undefined : `images/${photo.name}-640.webp 640w, images/${photo.name}-960.webp 960w`} sizes="(max-width: 720px) calc(100vw - 64px), 500px" width={width} height={photo.height} loading={priority ? "eager" : "lazy"} decoding="async" alt={hi ? photo.hi : photo.en} />
    <figcaption><span>{hi ? "स्कूली भोजन का प्रतिनिधि चित्र" : "Representative school-meal illustration"}</span><a href={photo.source} target="_blank" rel="noopener">{photo.credit} ↗</a></figcaption>
  </figure>
}

export function SchoolMealHero() {
  const { t } = useLang()
  return <div class="meal-hero-art">
    <SchoolMealPhoto kind="classroom" priority />
    <p class="meal-hero-caption">{t("homeVisual_mdm")}</p>
  </div>
}

export function SchoolMealStory() {
  const { lang } = useLang()
  const hi = lang === "hi"
  const root = useReveal()
  return <div ref={root} class="distribution-story meal-story"><section class="photo-band" data-reveal aria-labelledby="meal-story-title">
    <SchoolMealPhoto kind="serving" />
    <div class="photo-band-copy">
      <span class="eyebrow">{hi ? "हर बच्चा। हर थाली।" : "EVERY CHILD. EVERY PLATE."}</span>
      <h2 id="meal-story-title">{hi ? "गरम भोजन। सब बच्चों का हक़।" : "A hot meal. Every child’s right."}</h2>
      <p>{hi ? "स्कूल में कितने दिन भोजन मिला, कितने दिन नहीं मिला और क्या कम मिला—यहाँ दर्ज करें। दूसरे माता-पिता भी अपनी बात जोड़ सकते हैं।" : "Record the days a meal was served, missed meals and small portions. Other parents can add their confirmation to your school’s record."}</p>
      <div class="photo-story-points">
        <span><ActionIcon name="calendar" />{hi ? "भोजन के दिन" : "Meal days"}</span>
        <span><ActionIcon name="people" />{hi ? "माता-पिता की पुष्टि" : "Parents’ confirmations"}</span>
        <span><ActionIcon name="report" />{hi ? "स्कूल का रिकॉर्ड" : "School records"}</span>
      </div>
    </div>
  </section></div>
}
