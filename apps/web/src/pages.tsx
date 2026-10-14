import { useLang } from "./i18n"
import { Settings } from "./extras"
import { DeviceCard } from "./ui"
import { HomeFlow } from "./HomeFlow"
import { LandingHero } from "./Landing"
import { RoleHub } from "./roleUI"

export function Home() {
  return (
    <>
      <LandingHero />
      <RoleHub />
      <HomeFlow />
      <DeviceCard />
    </>
  )
}

const RAW_QUERY = `curl -s https://rpc.tiramisu.db-chain.testnet.arkiv.network \\
  -H 'content-type: application/json' \\
  -d "{\\"jsonrpc\\":\\"2.0\\",\\"id\\":1,\\"method\\":\\"arkiv_query\\",
       \\"params\\":[\\"project = str('tolmol') AND type = str('tolmol.report') AND shop_id = str('SYN-BR-0042')\\",
                 {\\"limit\\":\\"0xc8\\",\\"select\\":{\\"key\\":true,\\"creator\\":true,\\"attributes\\":true}}]}"`

export function About() {
  const { t } = useLang()
  return (
    <>
      <section class="card prose">
        <h2>{t("aboutTitle")}</h2>
        <p>{t("aboutIntro")}</p>
        <h3>{t("hardTitle")}</h3>
        <ul>
          <li>{t("hard1")}</li>
          <li>{t("hard2")}</li>
          <li>{t("hard3")}</li>
          <li>{t("hard4")}</li>
        </ul>
        <h3>{t("neverTitle")}</h3>
        <p>{t("neverText")}</p>
        <h3>{t("limitsTitle")}</h3>
        <p>
          {t("limitsText")}{" "}
          <a href="https://github.com/amannx21/Tolmol/blob/main/docs/THREAT_MODEL.md">{t("threatModel")}</a>
        </p>
        <h3>{t("syntheticTitle")}</h3>
        <p>{t("syntheticText")}</p>
      </section>
      <section class="card">
        <h3>{t("readCheck")}</h3>
        <pre class="code">{RAW_QUERY}</pre>
        <p class="small">
          {t("cliLine")} <code>npm run tolmol -- query --shop SYN-BR-0042</code> · {t("dataContract")}:{" "}
          <a href="https://github.com/amannx21/Tolmol/blob/main/arkiv/schema.md">arkiv/schema.md</a>
        </p>
        <p class="small">
          <strong>{t("mirrorLink")}:</strong> {t("mirrorHelp")}{" "}
          <a href="mirror.html" target="_blank" rel="noopener">
            mirror.html
          </a>
        </p>
      </section>
      <DeviceCard />
      <Settings />
    </>
  )
}
