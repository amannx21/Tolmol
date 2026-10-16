import { ExploreButton, FlowIcon } from "./HomeFlow"
import { setLang, useLang } from "./i18n"
import { usePrefs } from "./prefs"
import { speak } from "./speak"
import { ActionIcon } from "./ActionIcon"
import { DistributionStory } from "./ReferencePhotos"
import { HomeSchemeButtons } from "./workspace"

function FairMeasure() {
  const { lang } = useLang()
  const hi = lang === "hi"
  return <div class="fair-measure">
    <div class="measure-caption"><span class="seed-dot" />{hi ? "बराबर तौल। पूरा हक़।" : "Fair measure. A full share."}</div>
    <svg class="measure-scene" viewBox="0 0 460 350" fill="none" aria-hidden="true">
      <circle cx="230" cy="165" r="127" fill="var(--landing-halo)" />
      <circle cx="230" cy="165" r="145" stroke="var(--brand)" stroke-opacity=".09" stroke-dasharray="3 8" />
      <path d="M22 298c67-41 112-7 183-17 97-13 137-18 232 17v38H22Z" fill="var(--brand)" fill-opacity=".05" />
      <g stroke="var(--brand)" stroke-width="2" stroke-linecap="round" opacity=".55">
        <path d="M66 272V172m0 28c-18 0-24-12-24-21 17 1 24 11 24 21Zm0 19c18 0 24-12 24-21-17 1-24 11-24 21Zm0 19c-18 0-24-12-24-21 17 1 24 11 24 21ZM394 272V172m0 28c18 0 24-12 24-21-17 1-24 11-24 21Zm0 19c-18 0-24-12-24-21 17 1 24 11 24 21Zm0 19c18 0 24-12 24-21-17 1-24 11-24 21Z" />
      </g>
      <path d="M230 112v166m-35 12h70" stroke="var(--brand)" stroke-width="7" stroke-linecap="round" />
      <path d="M230 69c17 11 17 24 0 35-17-11-17-24 0-35Z" fill="#dca956" />
      <g class="balance-beam fair-scales">
        <path d="M105 132h250" stroke="var(--brand)" stroke-width="6" stroke-linecap="round" />
        <path d="m155 132-44 88m44-88 44 88m106-88-44 88m44-88 44 88" stroke="var(--brand)" stroke-width="2" stroke-linecap="round" />
        <g fill="#dca956">
          {[0, 1].map(side => <g key={side} transform={`translate(${side * 150} 0)`}>{[0, 1, 2, 3, 4].map((grain) => <ellipse key={grain} class={`falling-grain grain-${grain}`} cx={139 + grain * 8} cy={213 - (grain % 2) * 7} rx="5" ry="3" transform={`rotate(${grain % 2 ? -30 : 30} ${139 + grain * 8} ${213 - (grain % 2) * 7})`} />)}</g>)}
        </g>
        <path d="M111 220h88c-4 25-20 38-44 38s-40-13-44-38Zm150 0h88c-4 25-20 38-44 38s-40-13-44-38Z" fill="var(--brand)" />
        <path d="M118 226h74m76 0h74" stroke="var(--landing-halo)" stroke-width="2" stroke-linecap="round" opacity=".7" />
      </g>
      <circle cx="230" cy="132" r="9" fill="#dca956" />
      <g fill="var(--brand)"><circle cx="202" cy="312" r="5" /><circle cx="230" cy="307" r="6" /><circle cx="258" cy="312" r="5" /></g>
      <path d="M193 328c0-12 18-12 18 0m8 0c0-16 22-16 22 0m8 0c0-12 18-12 18 0" stroke="var(--brand)" stroke-width="3" stroke-linecap="round" />
    </svg>
    <div class="measure-footer"><span><FlowIcon kind="people" />{hi ? "मिलकर आवाज़ उठाएँ" : "A community, together"}</span><span class="equality-label">{hi ? "सबके लिए समान" : "Equal for all"}</span></div>
  </div>
}

/** Plain-language entry point shared by first-time visitors and both home modes. */
export function LandingHero({ animationKey = 0 }: { animationKey?: number } = {}) {
  const { lang } = useLang()
  const [prefs, setPrefs] = usePrefs()
  const hi = lang === "hi"
  const title = hi ? "पूरा राशन। सबका हक़।" : "Your ration. Your right."
  const description = hi ? "राशन कम मिला? यहाँ दर्ज करें। पड़ोसी भी बता सकते हैं। मिलकर दुकान का रिकॉर्ड देखें।" : "Got less ration? Record it here. Neighbours can confirm it. See your shop's record together."
  const begin = () => {
    if (!prefs.chosen) setPrefs({ mode: "easy", voice: true, chosen: true })
  }
  return <><section class="landing-hero" aria-labelledby="landing-title">
    <div class="landing-copy">
      <div class="landing-language" role="group" aria-label="भाषा चुनें / Choose language">
        <button class={hi ? "selected" : ""} aria-pressed={hi} onClick={() => setLang("hi")}>हिन्दी</button>
        <button class={!hi ? "selected" : ""} aria-pressed={!hi} onClick={() => setLang("en")}>English</button>
      </div>
      <p class="landing-slogan">{hi ? "सबके लिए समान" : "Equal for all"}<span aria-hidden="true"> · </span><span>{hi ? "आपकी आवाज़, आपका हक़" : "Your voice matters"}</span></p>
      <h1 id="landing-title">{hi ? <>पूरा राशन।<br /><em>सबका हक़।</em></> : <>Your ration.<br /><em>Your right.</em></>}</h1>
      <p class="landing-intro">{description}</p>
      <button class="landing-listen" onClick={() => speak(`${title} ${description}`, lang)}><ActionIcon name="listen" />{hi ? "सुनें" : "Listen"}<span class="listen-hint">{hi ? "यहाँ क्या कर सकते हैं" : "What you can do here"}</span></button>
      <div class="landing-actions">
        <a class="button landing-primary" href="#/report" onClick={begin}><FlowIcon kind="report" /><span>{hi ? "मुझे कम राशन मिला" : "I got less ration"}</span><span aria-hidden="true">→</span></a>
        <a class="button secondary" href={prefs.myShop ? `#/shop/${prefs.myShop}` : "#/dashboard"}><FlowIcon kind="shop" />{prefs.myShop ? hi ? "मेरी दुकान देखें" : "See my shop" : hi ? "दुकान का रिकॉर्ड देखें" : "See shop records"}</a>
      </div>
      <div class="landing-assurances"><span>✓ {hi ? "नाम नहीं माँगते" : "No name needed"}</span><span>✓ {hi ? "फ़ोन पर आसान" : "Easy on your phone"}</span></div>
      <ExploreButton />
    </div>
    <div class="landing-side">
      <FairMeasure key={animationKey} />
      <HomeSchemeButtons />
    </div>
  </section><DistributionStory /></>
}
