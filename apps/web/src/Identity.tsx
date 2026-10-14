import { useLang } from "./i18n"

export function Mark() {
  return <img src="icon.svg" width="46" height="46" alt="" aria-hidden="true" />
}

export function Mission({ compact = false }: { compact?: boolean }) {
  const { lang } = useLang()
  const hi = lang === "hi"
  return <div class={`mission ${compact ? "compact" : ""}`}>
    <div class="eyebrow"><span class="seed-dot" />{hi ? "आपका राशन। आपका हक़।" : "YOUR RATION. YOUR RIGHT."}</div>
    <h1>{hi ? <>हर दाने का<br/><em>हिसाब हो।</em></> : <>Every grain.<br/><em>Accounted for.</em></>}</h1>
    <p>{hi ? "कम राशन मिला? मिलकर उसका रिकॉर्ड बनाएँ।" : "A shared record. A stronger community. Make ration shortfalls visible, together."}</p>
    <div class="mission-art" aria-hidden="true">
      <svg viewBox="0 0 320 220" fill="none">
        <circle cx="160" cy="112" r="95" stroke="currentColor" stroke-opacity=".15"/>
        <circle cx="160" cy="112" r="72" stroke="currentColor" stroke-opacity=".12"/>
        <path d="M160 45v134m-38 0h76" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
        <g class="balance-beam">
          <path d="M75 80h170M90 80l-30 65h60L90 80Zm140 0-30 65h60l-30-65Z" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M60 145q30 38 60 0m80 0q30 38 60 0" fill="currentColor" fill-opacity=".16"/>
        </g>
        <circle class="grain-pivot" cx="160" cy="68" r="9" fill="#dca956"/>
        <path class="grain-sprout" d="M156 155v-40m0 13q-22-3-20-18 18 0 20 18Zm0 16q22-3 20-18-18 0-20 18Z" stroke="#dca956" stroke-width="3" stroke-linecap="round"/>
      </svg>
    </div>
    <div class="trust-line"><span>✓ {hi ? "नाम की ज़रूरत नहीं" : "No names required"}</span><span>✓ {hi ? "समुदाय की गवाही" : "Community witnessed"}</span></div>
  </div>
}
