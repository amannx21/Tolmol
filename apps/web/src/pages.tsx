import { useLang } from "./i18n"
import { DeviceCard } from "./ui"

export function Home() {
  const { t } = useLang()
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
          Demo shop: <a href="#/shop/SYN-BR-0042">SYN-BR-0042 (Gaya, synthetic)</a>
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
        <p>
          Tolmol ("weigh and bargain") keeps a public, tamper-evident record of how much ration grain people say they received at a fair-price
          shop, compared with their entitlement under the National Food Security Act. It runs on <a href="https://arkiv.network">Arkiv</a>, the
          Web3 database, on the Tiramisu testnet.
        </p>
        <h3>What makes it hard to erase</h3>
        <ul>
          <li>Each report is signed by an anonymous key created on the reporter's phone. Its on-chain creator can never be changed.</li>
          <li>Reports are created read-only and handed to an address nobody controls in the same transaction, so nobody can edit or delete them.</li>
          <li>Any other card holder can confirm a report from their own phone. Two confirmations extend its life automatically.</li>
          <li>The data lives on Arkiv, not on our server. If this website disappears, the records can still be read.</li>
        </ul>
        <h3>What Tolmol never stores</h3>
        <p>No names, phone numbers, Aadhaar, ration card numbers, photos or free text. Only shop, month, grain, entitled and received grams.</p>
        <h3>Synthetic data</h3>
        <p>Every shop in this demo is invented (IDs start with SYN-). The districts are real places; the shops and reports are not.</p>
      </section>
      <section class="card">
        <h3>{t("readCheck")}</h3>
        <pre class="code">{RAW_QUERY}</pre>
        <p class="small">
          Or from a clone of the repo: <code>npm run tolmol -- query --shop SYN-BR-0042</code>. Data contract:{" "}
          <a href="https://github.com/amannx21/Tolmol/blob/main/arkiv/schema.md">arkiv/schema.md</a>.
        </p>
      </section>
      <DeviceCard />
    </>
  )
}
