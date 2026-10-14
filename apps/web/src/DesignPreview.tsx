import { useState } from "preact/hooks"
import { ActionIcon, IconStyleContext } from "./ActionIcon"
import { HomeFlow } from "./HomeFlow"
import { LandingHero } from "./Landing"
import { useLang } from "./i18n"

const palettes = [
  { name: "Cream + Mustard", hi: "क्रीम + सरसों", bg: "#FFF8E7", brand: "#8A5B00", soft: "#F8EDC9", ink: "#3E3424", muted: "#776746", line: "#E7DABD", halo: "#F3DFA7" },
  { name: "White + Setting Sun", hi: "सफ़ेद + ढलता सूरज", bg: "#FFFFFF", brand: "#B94725", soft: "#FFF0E8", ink: "#3D302C", muted: "#78635B", line: "#EDDCD2", halo: "#FFE3CA" },
  { name: "Oat + Plum", hi: "हल्का क्रीम + प्लम", bg: "#F7F2EA", brand: "#71415D", soft: "#EFE3EB", ink: "#382C33", muted: "#74666E", line: "#E1D5DB", halo: "#EAD8E5" },
  { name: "Pearl + Slate Blue", hi: "सफ़ेद + स्लेट नीला", bg: "#FAFBFD", brand: "#496685", soft: "#EAF0F6", ink: "#293444", muted: "#637185", line: "#D7E0E9", halo: "#DEE9F4" },
  { name: "Sand + Copper", hi: "रेतीला क्रीम + तांबा", bg: "#FBF5EC", brand: "#A34E32", soft: "#F4E4D9", ink: "#3D302A", muted: "#796A60", line: "#E7D7CA", halo: "#F3D9BD" },
  { name: "Ivory + Coral", hi: "आइवरी + कोरल", bg: "#FFFCF7", brand: "#B94D45", soft: "#FCE9E3", ink: "#3C302D", muted: "#7D6861", line: "#EEDAD2", halo: "#F9DDD0" },
]

/** Review colour, emoji and motion choices against the real landing components. */
export function DesignPreview() {
  const { lang } = useLang()
  const hi = lang === "hi"
  const [selected, setSelected] = useState(0)
  const [replay, setReplay] = useState(0)
  const palette = palettes[selected]!
  return <IconStyleContext.Provider value="emoji"><div class="design-preview" style={{
    "--bg": palette.bg, "--card": "#FFFFFF", "--brand": palette.brand, "--brand-ink": "#FFFFFF",
    "--soft": palette.soft, "--ink": palette.ink, "--muted": palette.muted, "--line": palette.line,
    "--landing-halo": palette.halo, "--accent": "#DCA956", "--warn": "#8A5B00", "--ok": "#28704B",
  }}>
    <header class="preview-toolbar">
      <div class="preview-toolbar-heading"><div><p class="eyebrow">{hi ? "तोलमोल · डिज़ाइन देखें" : "TOLMOL · DESIGN PREVIEW"}</p><h1>{hi ? "रंग, इमोजी और एनिमेशन साथ देखें।" : "Colours, emojis and motion. Together."}</h1></div><a class="inline-action" href="#/"><ActionIcon name="back" />{hi ? "ऐप पर जाएँ" : "Back to app"}</a></div>
      <div class="palette-picker" role="group" aria-label={hi ? "रंग चुनें" : "Choose a palette"}>{palettes.map((option, index) => <button key={option.name} class={index === selected ? "selected" : ""} aria-pressed={index === selected} onClick={() => { setSelected(index); setReplay(replay + 1) }}><span class="palette-swatch" style={{ background: option.brand }} aria-hidden="true" />{hi ? option.hi : option.name}</button>)}</div>
      <div class="preview-playback"><p>{hi ? "🌾 दाने गिरते हैं → ⚖️ तराज़ू बराबर होता है। नीचे स्क्रॉल करें।" : "🌾 Grain drops → ⚖️ scales settle level. Scroll to see the cards reveal."}</p><button class="secondary" onClick={() => setReplay(replay + 1)}><span aria-hidden="true">▶️ </span>{hi ? "एनिमेशन फिर देखें" : "Replay animation"}</button></div>
    </header>
    <div class="preview-site-header"><a class="preview-wordmark" href="#/"><span aria-hidden="true">⚖️</span><span>Tolmol<small>{hi ? "सबके लिए समान" : "Equal for all"}</small></span></a><span class="preview-label">{hi ? "लाइव डिज़ाइन प्रीव्यू" : "LIVE DESIGN PREVIEW"}</span></div>
    <main class="preview-content"><LandingHero animationKey={replay} /><HomeFlow key={selected} /></main>
    <footer class="preview-foot">{hi ? "डिज़ाइन का नमूना। रिपोर्ट और दुकान के बटन मौजूदा ऐप खोलते हैं।" : "Design sample. Report and shop buttons open the existing app."}</footer>
  </div></IconStyleContext.Provider>
}
