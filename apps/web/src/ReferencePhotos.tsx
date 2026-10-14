import { ActionIcon } from "./ActionIcon"
import { useLang } from "./i18n"
import { useState } from "preact/hooks"
import { useReveal } from "./motion"

export function ReferencePhoto({ kind }: { kind: "shop" | "distribution" | "weighing" | "community" }) {
  const { lang } = useLang()
  const [missing, setMissing] = useState(false)
  const hi = lang === "hi"
  const photos = {
    shop: { name: "pds-shop", height: 540, source: "https://news.cornell.edu/stories/2022/10/new-project-will-reveal-true-cost-indias-food-subsidies", credit: "PradeepGaurs / Shutterstock · Cornell Chronicle", alt: "People gathered outside a yellow public distribution shop", hi: "पीली राशन दुकान के बाहर अनाज लेने आए लोग" },
    distribution: { name: "ration-distribution", height: 543, source: "https://www.hindustantimes.com/india-news/demand-for-ration-cards-increases-amid-lockdown/story-xwaP0y153pnzrz91FAdKAI.html", credit: "Diwakar Prasad / Hindustan Times", alt: "Grain being measured and distributed to customers inside a ration shop", hi: "राशन दुकान में ग्राहकों के सामने अनाज नापकर दिया जा रहा है" },
    weighing: { name: "ration-weighing", height: 599, source: "https://haryanafood.gov.in/pds-2/", credit: "Source: Haryana Food Department", alt: "A shop worker weighs grain for a customer while another worker records the distribution", hi: "ग्राहक के लिए अनाज तौला जा रहा है और वितरण का रिकॉर्ड लिखा जा रहा है" },
    community: { name: "ration-community", height: 635, source: "https://krishijagran.com/news/one-nation-one-ration-card-all-you-need-to-know-about-government-s-new-scheme-how-to-avail-its-benefit/", credit: "Source: Krishi Jagran", alt: "Card holders waiting together while grain is measured at a ration shop", hi: "राशन दुकान में अनाज लेते और अपनी बारी का इंतज़ार करते कार्ड धारक" },
  }
  const photo = photos[kind]
  // Photos are optional decoration: if a file is not deployed (e.g. pending a licence), show nothing rather than a broken image.
  if (missing) return null
  return <figure class={`reference-photo photo-${kind}`}>
    <img src={`images/${photo.name}-960.webp`} srcSet={`images/${photo.name}-640.webp 640w, images/${photo.name}-960.webp 960w`} sizes="(max-width: 720px) calc(100vw - 32px), 520px" width="960" height={photo.height} loading="lazy" decoding="async" alt={hi ? photo.hi : photo.alt} onError={() => setMissing(true)} />
    <figcaption><span>{hi ? "राशन व्यवस्था का प्रतिनिधि फ़ोटो" : "Representative PDS photograph"}</span><a href={photo.source} target="_blank" rel="noopener">{photo.credit} ↗</a></figcaption>
  </figure>
}

export function ReportIntro() {
  const { lang } = useLang()
  const hi = lang === "hi"
  return <aside class="report-intro"><ReferencePhoto kind="weighing" /><div><h3>{hi ? "दुकान चुनें। अपनी बात दर्ज करें।" : "Choose your shop. Tell us what happened."}</h3><p>{hi ? "राशन की मात्रा और कोई समस्या बताइए। भेजने से पहले आप सब कुछ जाँच सकेंगे।" : "Tell us the grain amounts and any other issues. You can check everything before sending."}</p></div></aside>
}

export function DistributionStory() {
  const { lang } = useLang()
  const hi = lang === "hi"
  const root = useReveal()
  return <div ref={root} class="distribution-story"><section class="photo-band" data-reveal aria-labelledby="distribution-title">
    <ReferencePhoto kind="distribution" />
    <div class="photo-band-copy"><span class="eyebrow">{hi ? "आपकी दुकान। आपका राशन।" : "YOUR SHOP. YOUR RATION."}</span><h2 id="distribution-title">{hi ? "जितना मिला, उतना दर्ज करें।" : "A clear record of what you received."}</h2><p>{hi ? "कितना राशन मिलना था और कितना मिला—दोनों बताइए। उसी दुकान के दूसरे लोग अपनी बात जोड़ सकते हैं।" : "Record what you were entitled to and what you received. Other card holders at the same shop can add their confirmation."}</p><div class="photo-story-points"><span><ActionIcon name="grain" />{hi ? "राशन की मात्रा" : "Grain quantities"}</span><span><ActionIcon name="people" />{hi ? "पड़ोसियों की पुष्टि" : "Neighbours' confirmations"}</span><span><ActionIcon name="report" />{hi ? "साझा रिकॉर्ड" : "A shared record"}</span></div></div>
  </section></div>
}
