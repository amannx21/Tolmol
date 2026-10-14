import { useFmt, useLang } from "./i18n"
import { DeviceCard } from "./ui"

export function Home() {
  const { t } = useLang()
  const f = useFmt()
  return (
    <>
      <section class="hero">
        <h1>{t("tagline")}</h1>
        <p>{t("homeWhy")}</p>
        <div class="row wrap">
          <a class="button" href="#/report">
            {t("ctaReport")}
          </a>
          <a class="button secondary" href="#/dashboard">
            {t("ctaDashboard")}
          </a>
        </div>
      </section>
      <section class="card">
        <ol class="steps">
          <li>{t("homeHow1")}</li>
          <li>{t("homeHow2")}</li>
          <li>{t("homeHow3")}</li>
        </ol>
        <p class="small">
          {t("demoShop")}: <a href="#/shop/SYN-BR-0042">SYN-BR-0042 ({f.district("gaya")})</a>
        </p>
      </section>
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
      </section>
      <DeviceCard />
    </>
  )
}
