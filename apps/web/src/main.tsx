import { render } from "preact"
import { Dashboard } from "./Dashboard"
import { About, Home } from "./pages"
import { ReportForm } from "./ReportForm"
import { ReportView } from "./ReportView"
import { startQueue, useQueueCount } from "./queue"
import { useRoute } from "./router"
import { ShopPage } from "./ShopPage"
import { useLang } from "./i18n"
import { Layout } from "./ui"
import "./styles.css"

function QueueBanner() {
  const n = useQueueCount()
  const { t } = useLang()
  return n > 0 ? (
    <p class="queue" role="status">
      {n} {t("queuedCount")}
    </p>
  ) : null
}

function App() {
  const route = useRoute()
  let page
  switch (route.name) {
    case "report":
      page = <ReportForm initialShop={route.shopId} />
      break
    case "dashboard":
      page = <Dashboard initialState={route.state} />
      break
    case "shop":
      page = <ShopPage shopId={route.shopId} month={route.month} atBlock={route.atBlock} />
      break
    case "r":
      page = <ReportView reportKey={route.key as `0x${string}`} />
      break
    case "about":
      page = <About />
      break
    default:
      page = <Home />
  }
  return (
    <Layout route={route}>
      <QueueBanner />
      {page}
    </Layout>
  )
}

render(<App />, document.getElementById("app")!)
startQueue()
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {
    /* offline support is optional */
  })
}
