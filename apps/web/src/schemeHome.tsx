// "What are you here about?" The first choice on the site, then a home for that scheme. Ration keeps the original
// home (LandingHero, RoleHub, HomeFlow) exactly as designed; school meals and MGNREGA wages get their own home built
// from the same landing styles. The choice is remembered on this phone and can be switched at the top of the home.
import type { Scheme } from "tolmol-sdk"
import { ActionIcon } from "./ActionIcon"
import { setLang, useLang, type Key } from "./i18n"
import { setPrefs, usePrefs } from "./prefs"
import { RoleHub } from "./roleUI"
import { speak } from "./speak"
import { SchoolMealHero, SchoolMealPhoto, SchoolMealStory } from "./SchoolMealPhotos"
import { WageHero, WageStory } from "./WagePhotos"

const ICON: Record<Scheme, string> = { pds: "🌾", mdm: "🍲", nrega: "⛏️" }

function LanguageButtons() {
  const { lang } = useLang()
  return (
    <div class="landing-language" role="group" aria-label="भाषा चुनें / Choose language">
      <button class={lang === "hi" ? "selected" : ""} aria-pressed={lang === "hi"} onClick={() => setLang("hi")}>
        हिन्दी
      </button>
      <button class={lang !== "hi" ? "selected" : ""} aria-pressed={lang !== "hi"} onClick={() => setLang("en")}>
        English
      </button>
    </div>
  )
}

/** #/schemes: the add-ons. Without a choice, the two of them side by side; with one, its home. */
export function AddOnsPage({ scheme }: { scheme?: "mdm" | "nrega" }) {
  const { t } = useLang()
  if (scheme)
    return (
<SchemeHome scheme={scheme} />
    )
  return (
    <section class="card easy welcome-card scheme-gate" aria-labelledby="addons-title">
      <a class="link-back" href="#/">
        ← {ICON.pds} {t("backToRation")}
      </a>
      <h1 id="addons-title">{t("addOnsTitle")}</h1>
      <p>{t("addOnsHelp")}</p>
      <div class="bigcol">
        {(["mdm", "nrega"] as const).map((s) => (
          <a class="big-choice" href={`#/schemes/${s}`}>
            <span class="icon" aria-hidden="true">
              {ICON[s]}
            </span>
            <strong>{t(`gate_${s}` as Key)}</strong>
            <span class="small">{t(`addOnProblem_${s}` as Key)}</span>
          </a>
        ))}
      </div>
    </section>
  )
}

/** Easy or Full, asked once, for visitors who chose school meals or wages first. */
function ModeChoice() {
  const { t } = useLang()
  return (
    <section class="card easy welcome-card welcome-options">
      <h2>{t("chooseMode")}</h2>
      <div class="bigcol">
        <button class="big-choice" onClick={() => setPrefs({ mode: "easy", voice: true, chosen: true })}>
          <span class="icon" aria-hidden="true">👆</span>
          <strong>{t("modeEasy")}</strong>
          <span class="small">{t("modeEasyHelp")}</span>
        </button>
        <button class="big-choice" onClick={() => setPrefs({ mode: "full", chosen: true })}>
          <span class="icon" aria-hidden="true">📊</span>
          <strong>{t("modeFull")}</strong>
          <span class="small">{t("modeFullHelp")}</span>
        </button>
      </div>
    </section>
  )
}

/** Home for school meals or MGNREGA wages, in the landing page's own style. */
export function SchemeHome({ scheme }: { scheme: Exclude<Scheme, "pds"> }) {
  const { t, lang } = useLang()
  const [prefs] = usePrefs()
  const title1 = t(`home1_${scheme}` as Key)
  const title2 = t(`home2_${scheme}` as Key)
  const intro = t(`homeIntro_${scheme}` as Key)
  return (
    <>
      <section class={`landing-hero ${scheme === "mdm" ? "meal-home-hero" : "wage-home-hero"}`} aria-labelledby="scheme-title">
        <div class="landing-copy">
          <LanguageButtons />
          <p class="landing-slogan">
            {t(`schemeLong_${scheme}` as Key)}
          </p>
          <h1 id="scheme-title">
            {title1}
            <br />
            <em>{title2}</em>
          </h1>
          <p class="landing-intro">{intro}</p>
          <button class="landing-listen" onClick={() => speak(`${title1} ${title2} ${intro}`, lang)}>
            <ActionIcon name="listen" />
            {t("listen")}
          </button>
          <div class="landing-actions">
            <a class="button landing-primary" href={`#/report?scheme=${scheme}`}>
              <ActionIcon name="report" />
              <span>{t(`homeCta_${scheme}` as Key)}</span>
              <span aria-hidden="true">→</span>
            </a>
            <a class="button secondary" href={`#/dashboard?scheme=${scheme}`}>
              <ActionIcon name="dashboard" />
              {t(`homeRecords_${scheme}` as Key)}
            </a>
          </div>
          <div class="landing-assurances">
            <span>✓ {t("homeNoName")}</span>
            <span>✓ {t("homeEasyPhone")}</span>
            <span>✓ {t("homeListenTap")}</span>
          </div>
        </div>
        {scheme === "mdm" ? <SchoolMealHero /> : <WageHero />}
      </section>
      {!prefs.chosen && <ModeChoice />}
      {scheme === "mdm" ? <SchoolMealStory /> : <WageStory />}
      <section class={`card scheme-steps ${scheme === "mdm" ? "meal-steps" : ""}`}>
        <div>
        <h2>{t("homeHowTitle")}</h2>
        <ol>
          {[1, 2, 3, 4].map((n) => (
            <li>{t(`homeStep${n}_${scheme}` as Key)}</li>
          ))}
        </ol>
        </div>
        {scheme === "mdm" && <SchoolMealPhoto kind="child" />}
      </section>
      <RoleHub scheme={scheme} />
    </>
  )
}
