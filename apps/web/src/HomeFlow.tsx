import { useLang } from "./i18n"
import { useReveal } from "./motion"
import { ActionIcon, IconStyleContext } from "./ActionIcon"
import { useContext } from "preact/hooks"
import { ReferencePhoto } from "./ReferencePhotos"

const DEMO = "#/shop/SYN-BR-0042"

export function FlowIcon({ kind }: { kind: "report" | "people" | "check" | "shop" | "letter" | "shield" }) {
  const style = useContext(IconStyleContext)
  if (style === "emoji") return <ActionIcon name={kind} />
  const paths = {
    report: "M8 4h8l4 4v12H4V4h4Zm8 0v5h4M8 13h8M8 17h5",
    people: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-4M16 3a4 4 0 0 1 0 8",
    check: "m8 12 3 3 5-6M20 12a8 8 0 1 1-8-8",
    shop: "M4 10v10h16V10M3 10l2-6h14l2 6M9 20v-6h6v6M3 10h18",
    letter: "M3 6h18v14H3V6Zm0 0 9 8 9-8",
    shield: "M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Zm-4 9 3 3 5-6",
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={paths[kind]} />{kind === "people" && <circle cx="9" cy="7" r="4" />}</svg>
}

export function ExploreButton() {
  const { lang } = useLang()
  return <button class="text-action" onClick={() => {
    const section = document.getElementById("home-process")
    section?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" })
    section?.focus({ preventScroll: true })
  }}>{lang === "hi" ? "देखें यह कैसे काम करता है" : "Explore what you can do"}<span aria-hidden="true">↓</span></button>
}

/** Discovery links expose existing workflows; no extra data reads or fabricated statistics. */
export function HomeFlow({ easy = false }: { easy?: boolean }) {
  const motionRoot = useReveal()
  const { t, lang } = useLang()
  const hi = lang === "hi"
  const copy = (en: string, hindi: string) => hi ? hindi : en
  const steps = [
    { icon: "report" as const, title: copy("Tell your side", "अपनी बात दर्ज करें"), body: t("homeHow1"), action: t("ctaReport"), href: "#/report" },
    { icon: "people" as const, title: copy("Build a shared record", "मिलकर रिकॉर्ड बनाएँ"), body: t("homeHow2"), action: copy("Find a shop", "दुकान खोजें"), href: "#/dashboard" },
    { icon: "check" as const, title: copy("Turn evidence into action", "सबूत से कार्रवाई तक"), body: t("homeHow3"), action: copy("Explore the demo shop", "डेमो दुकान देखें"), href: DEMO },
  ]
  const tools = [
    { icon: "shop" as const, title: copy("A shop's full story", "दुकान का पूरा रिकॉर्ड"), body: copy("Follow monthly shortfalls, confirmations, dealer replies and official actions in one place.", "महीने की कमी, गवाहियाँ, दुकानदार के जवाब और अधिकारी की कार्रवाई एक जगह देखें।"), action: copy("Open shop timeline", "दुकान का रिकॉर्ड खोलें"), href: DEMO },
    { icon: "letter" as const, title: copy("Letters that start with evidence", "सबूत के साथ शिकायत"), body: copy("Draft an RTI or a grievance complaint from a shop's record, ready to download and fill in.", "दुकान के रिकॉर्ड से RTI या शिकायत का मसौदा बनाएँ, डाउनलोड करें और भरें।"), action: copy("Try an RTI draft", "RTI का मसौदा देखें"), href: `${DEMO}?letter=rti` },
    { icon: "check" as const, title: copy("Evidence you can check", "जाँचे जा सकने वाले सबूत"), body: copy("Download CSV or JSON from a shop, then check an exported JSON file against the original records.", "दुकान से CSV या JSON डाउनलोड करें। JSON फ़ाइल को मूल रिकॉर्ड से मिलाकर जाँचें।"), action: t("verifyTitle"), href: "#/verify" },
    { icon: "shield" as const, title: copy("Try verified participation", "सत्यापित सदस्य बनकर देखें"), body: copy("Explore synthetic test cards for card holders, dealers and officials. Verification stays optional.", "कार्ड धारक, दुकानदार और अधिकारी के नकली टेस्ट कार्ड देखें। सत्यापन वैकल्पिक है।"), action: copy("Explore test cards", "टेस्ट कार्ड देखें"), href: "#/test-cards" },
  ]
  return <div ref={motionRoot} class={`home-flow ${easy ? "flow-easy" : ""}`}>
    <section class="flow-section" id="home-process" tabIndex={-1} aria-labelledby="process-title">
      <div class="section-heading"><div><span class="eyebrow">{copy("FROM ONE VOICE TO A SHARED RECORD", "एक आवाज़ से साझा रिकॉर्ड तक")}</span><h2 id="process-title">{copy("Three steps. A stronger voice.", "तीन कदम। मज़बूत आवाज़।")}</h2></div><span class="section-note">{copy("Start small. Let the evidence grow.", "शुरुआत करें। सबूत मिलकर बनाएँ।")}</span></div>
      <div class="journey-grid">{steps.map((step, index) => <article class="journey-card" key={step.href} data-reveal style={{ "--reveal-delay": `${index * 60}ms` }}>
        <div class="journey-top"><span class="feature-icon"><FlowIcon kind={step.icon} /></span><span class="step-number">0{index + 1}</span></div>
        <h3>{step.title}</h3><p>{step.body}</p><a class="inline-action" href={step.href}>{step.action}<span aria-hidden="true">↗</span></a>
      </article>)}</div>
    </section>

    <section class="shop-spotlight" data-reveal aria-labelledby="spotlight-title">
      <div class="spotlight-copy"><span class="eyebrow">{copy("EXPLORE THE DEMO", "डेमो देखें")}</span><h2 id="spotlight-title">{copy("Behind every number, a shop's story.", "हर आँकड़े के पीछे एक दुकान का रिकॉर्ड।")}</h2><p>{copy("See how reports become a public timeline — and how a shop can respond without erasing what happened.", "देखें कैसे रिपोर्ट से सार्वजनिक रिकॉर्ड बनता है और दुकानदार पुराने रिकॉर्ड को मिटाए बिना जवाब दे सकता है।")}</p><div class="action-group"><a class="button" href={DEMO}><ActionIcon name="shop" />{copy("Explore this shop", "यह दुकान देखें")} <span aria-hidden="true">→</span></a><a class="inline-action" href="#/dashboard">{t("seeAllShops")} <span aria-hidden="true">↗</span></a></div></div>
      <div class="shop-preview"><ReferencePhoto kind="shop" /><p class="shop-photo-note">{copy("Photo for context. The demo shop and its reports are synthetic.", "फ़ोटो संदर्भ के लिए है। डेमो दुकान और रिपोर्टें नकली हैं।")}</p><div class="preview-top"><span class="feature-icon"><FlowIcon kind="shop" /></span><span class="demo-pill">{copy("SYNTHETIC DEMO", "नकली डेमो")}</span></div><h3>{copy("Gaya, Bihar", "गया, बिहार")}</h3><p class="mono small muted">SYN-BR-0042</p><ol class="preview-timeline"><li><strong>{copy("Reports & confirmations", "रिपोर्ट और गवाहियाँ")}</strong><span>{copy("What people received. What neighbours witnessed.", "कितना राशन मिला। पड़ोसियों ने क्या देखा।")}</span></li><li><strong>{copy("Responses & follow-ups", "जवाब और आगे की स्थिति")}</strong><span>{copy("Shops answer. Reporters say if it was fixed.", "दुकानदार जवाब दें। रिपोर्ट करने वाला बताए कि समस्या हल हुई या नहीं।")}</span></li><li><strong>{copy("Evidence & next steps", "सबूत और अगले कदम")}</strong><span>{copy("Exports, letters and the department's actions.", "डाउनलोड, पत्र और विभाग की कार्रवाई।")}</span></li></ol><p class="preview-note">{copy("A guide to the shop page, using synthetic data.", "नकली डेटा से दुकान के पेज की जानकारी।")}</p></div>
    </section>

    {!easy && <section class="flow-section" aria-labelledby="tools-title"><div class="section-heading"><div><span class="eyebrow">{copy("MORE WAYS TO USE TOLMOL", "तोलमोल का और उपयोग")}</span><h2 id="tools-title">{copy("The tools behind the record.", "रिकॉर्ड से जुड़े उपयोगी साधन।")}</h2></div></div><div class="tool-grid">{tools.map((tool, index) => <article class="tool-card" key={tool.href} data-reveal style={{ "--reveal-delay": `${(index % 2) * 60}ms` }}><span class="feature-icon"><FlowIcon kind={tool.icon} /></span><div><h3>{tool.title}</h3><p>{tool.body}</p><a class="inline-action" href={tool.href}>{tool.action}<span aria-hidden="true">↗</span></a></div></article>)}</div></section>}

    <section class="trust-panel" data-reveal aria-labelledby="trust-title"><span class="feature-icon"><FlowIcon kind="shield" /></span><div><span class="eyebrow">{copy("YOUR VOICE. YOUR PRIVACY.", "आपकी आवाज़। आपकी निजता।")}</span><h2 id="trust-title">{copy("A record of the problem, without your name.", "समस्या का रिकॉर्ड, आपके नाम के बिना।")}</h2><p>{copy("No name, phone number or Aadhaar is requested in a report. Your phone signs it, and other card holders can confirm it.", "रिपोर्ट में नाम, फ़ोन नंबर या आधार नहीं माँगा जाता। आपका फ़ोन इसे दर्ज करता है और दूसरे कार्ड धारक इसकी पुष्टि कर सकते हैं।")}</p><a class="inline-action" href="#/about">{copy("Understand how Tolmol works", "जानें तोलमोल कैसे काम करता है")} <span aria-hidden="true">→</span></a></div></section>

    <section class="flow-section faq-section" aria-labelledby="faq-title"><div class="section-heading"><div><span class="eyebrow">{copy("BEFORE YOU START", "शुरू करने से पहले")}</span><h2 id="faq-title">{copy("A few things to know.", "कुछ ज़रूरी बातें।")}</h2></div></div><div class="faq-list">
      <details><summary>{copy("What if I have no internet?", "इंटरनेट न हो तो?")}</summary><p>{copy("After the app has loaded once, its saved shell can open offline. An offline report is kept on this phone and sent when the connection returns. Keep the browser's saved data.", "ऐप एक बार खुलने के बाद ऑफ़लाइन खुल सकता है। बिना इंटरनेट की रिपोर्ट फ़ोन में रहती है और कनेक्शन आने पर भेजी जाती है। ब्राउज़र का डेटा बनाए रखें।")}</p></details>
      <details><summary>{copy("Can I correct a mistake?", "गलती हो जाए तो?")}</summary><p>{copy("From the phone that filed it, withdraw the report and file a corrected one. The original stays visible as withdrawn and stops counting in totals.", "जिस फ़ोन से रिपोर्ट दर्ज की, उससे रिपोर्ट वापस लें और सही रिपोर्ट दर्ज करें। पुरानी रिपोर्ट वापस ली गई के रूप में दिखेगी, लेकिन कुल में गिनी नहीं जाएगी।")}</p></details>
      <details><summary>{copy("Are these real shops and complaints?", "क्या ये असली दुकानें और शिकायतें हैं?")}</summary><p>{t("synthetic")}</p></details>
    </div></section>

    <section class="closing-action" data-reveal><div><span class="eyebrow">{copy("MAKE YOUR EXPERIENCE COUNT", "अपना अनुभव दर्ज करें")}</span><h2>{copy("Less grain? Start with a record.", "कम राशन मिला? रिकॉर्ड से शुरुआत करें।")}</h2><p>{copy("Choose your shop. Record what you received. Share with a neighbour.", "दुकान चुनें। मिला राशन दर्ज करें। पड़ोसी से साझा करें।")}</p></div><a class="button" href="#/report"><ActionIcon name="report" />{t("ctaReport")} <span aria-hidden="true">→</span></a></section>
  </div>
}
