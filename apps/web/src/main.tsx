import { render } from "preact"
import { Dashboard } from "./Dashboard"
import { EasyHome, EasyReport, Welcome } from "./Easy"
import { usePrefs } from "./prefs"
import { About, Home } from "./pages"
import { ReportForm } from "./ReportForm"
import { ReportView } from "./ReportView"
import { startQueue, useQueueCount } from "./queue"
import { useRoute } from "./router"
import { ShopPage } from "./ShopPage"
import { VerifyPage } from "./extras"
import { CardPage, TestCardsPage } from "./verified"
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
  const [prefs] = usePrefs()
  const easy = prefs.mode === "easy"
  let page
  switch (route.name) {
    case "report":
      page = (route.view ?? (easy ? "easy" : "full")) === "easy" ? <EasyReport initialShop={route.shopId} /> : <ReportForm initialShop={route.shopId} />
      break
    case "dashboard":
      page = <Dashboard initialState={route.state} />
      break
    case "shop":
      page = <ShopPage shopId={route.shopId} month={route.month} atBlock={route.atBlock} letter={route.letter} />
      break
    case "r":
      page = <ReportView reportKey={route.key as `0x${string}`} />
      break
    case "about":
      page = <About />
      break
    case "card":
      page = <CardPage c={route.c} />
      break
    case "testCards":
      page = <TestCardsPage />
      break
    case "verify":
      page = <VerifyPage />
      break
    default:
      // First visit: ask language and Easy/Full before anything else. Shared links skip this and open directly.
      page = !prefs.chosen ? <Welcome /> : easy ? <EasyHome /> : <Home />
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
