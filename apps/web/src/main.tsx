import { Component, render, type ComponentChildren } from "preact"
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
import { MyActivityPage, TourPage } from "./roleUI"
import { useLang } from "./i18n"
import { Layout } from "./ui"
import { DesignPreview } from "./DesignPreview"
import { ReportEntry } from "./SchemeEntry"
import { ProofPage } from "./proofUI"
import { TrustPage } from "./trust"
import { RawPage } from "./rawPage"
import { AddOnsPage } from "./schemeHome"
import { MyOutletPage } from "./operatorUI"
import { TrackPage } from "./trackUI"
import "./styles.css"
import "./design.css"
import "./flow.css"
import "./motion.css"
import "./landing.css"
import "./actions.css"
import "./preview.css"
import "./photos.css"
import "./amount.css"
import "./report-receipt.css"
import "./theme.css"

function QueueBanner() {
  const n = useQueueCount()
  const { t } = useLang()
  return n > 0 ? (
    <p class="queue" role="status">
      {n} {t("queuedCount")}
    </p>
  ) : null
}

/** One broken record or component must not blank the whole site: show a message for this page only. */
class PageGuard extends Component<{ children: ComponentChildren }, { failed: boolean }> {
  override state = { failed: false }
  override componentDidCatch(error: unknown) {
    console.error("[Tolmol] page error", error)
    this.setState({ failed: true })
  }
  override render() {
    return this.state.failed ? <PageFailed /> : this.props.children
  }
}
function PageFailed() {
  const { t } = useLang()
  return (
    <section class="card" role="alert">
      <p class="err">{t("pageFailed")}</p>
      <p>
        <a href="#/">{t("navHome")}</a> · <a href={location.hash} onClick={() => location.reload()}>{t("tryAgain")}</a>
      </p>
    </section>
  )
}

function App() {
  const route = useRoute()
  const [prefs] = usePrefs()
  const easy = prefs.mode === "easy"
  if (route.name === "designPreview") return <DesignPreview />
  let page
  switch (route.name) {
    case "report":
      page = (
        <ReportEntry shopId={route.shopId} scheme={route.scheme}>
          {(route.view ?? (easy ? "easy" : "full")) === "easy" ? <EasyReport initialShop={route.shopId} /> : <ReportForm initialShop={route.shopId} />}
        </ReportEntry>
      )
      break
    case "dashboard":
      page = <Dashboard initialState={route.state} scheme={route.scheme} />
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
    case "me":
      page = <MyActivityPage />
      break
    case "tour":
      page = <TourPage />
      break
    case "proof":
      page = <ProofPage p={route.p} />
      break
    case "trust":
      page = <TrustPage />
      break
    case "raw":
      page = <RawPage />
      break
    case "schemes":
      page = <AddOnsPage scheme={route.s} />
      break
    case "myOutlet":
      page = <MyOutletPage />
      break
    case "track":
      page = <TrackPage state={route.state} />
      break
    case "card":
      page = <CardPage c={route.c} />
      break
    case "testCards":
      page = <TestCardsPage role={route.role} />
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
      <PageGuard key={location.hash}>{page}</PageGuard>
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
