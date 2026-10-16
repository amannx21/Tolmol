// #/raw: read the evidence without Tolmol. Every query the app makes for one outlet, captured from the app's own code
// (the SDK functions run against a recording transport, so nothing is sent while building this page), with the exact
// JSON-RPC body ready to copy as curl, JavaScript or Python. Any Arkiv endpoint answers them; no Tolmol server exists.
import { createPublicClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { useEffect, useState } from "preact/hooks"
import { custom } from "viem"
import {
  listAttestations,
  listOutlets,
  listVerifiers,
  outletRecord,
  shopCorrections,
  shopFollowups,
  shopOfficialActions,
  shopReports,
  shopResponses,
  shopStocks,
  shopWitnesses,
  TIRAMISU_HTTP,
  type Reader,
} from "tolmol-sdk"
import { rpcSetting } from "./arkiv"
import { useLang, type Key } from "./i18n"
import { curlFor } from "./rpc"
import { trustedRegistry } from "./trust"

type Captured = { id: string; method: string; params: unknown }

/** Runs one SDK read against a transport that records the request instead of sending it. */
async function capture(run: (r: Reader) => Promise<unknown>): Promise<Captured | null> {
  let got: Captured | null = null
  const transport = custom({
    async request({ method, params }: { method: string; params?: unknown }) {
      if (method === "eth_blockNumber") return "0x0"
      if (method === "arkiv_query") {
        // Drop the placeholder block pin, so a copied query reads the latest state.
        const [q, o] = params as [string, Record<string, unknown>]
        got ??= { id: "", method, params: [q, { ...o, atBlock: undefined }] }
        return { data: [], blockNumber: "0x0" }
      }
      return null
    },
  })
  try {
    await run(createPublicClient({ chain: tiramisu, transport }) as unknown as Reader)
  } catch {
    /* an empty answer may not parse; the request is what we want */
  }
  return got
}

const QUERIES: { id: string; run: (r: Reader, shop: string) => Promise<unknown> }[] = [
  { id: "outlets", run: (r) => listOutlets(r, {}, { registry: trustedRegistry() }) },
  { id: "everything", run: (r, s) => outletRecord(r, s) },
  { id: "reports", run: (r, s) => shopReports(r, s) },
  { id: "witnesses", run: (r, s) => shopWitnesses(r, s) },
  { id: "corrections", run: (r, s) => shopCorrections(r, s) },
  { id: "stock", run: (r, s) => shopStocks(r, s) },
  { id: "responses", run: (r, s) => shopResponses(r, s) },
  { id: "followups", run: (r, s) => shopFollowups(r, s) },
  { id: "actions", run: (r, s) => shopOfficialActions(r, s) },
  { id: "verifiers", run: (r) => listVerifiers(r, { registry: trustedRegistry() }) },
  { id: "attestations", run: (r) => listAttestations(r) },
]

const python = (url: string, method: string, params: unknown) => `import json, urllib.request
params = json.loads(r'''${JSON.stringify(params)}''')
body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "${method}", "params": params}).encode()
req = urllib.request.Request("${url}", body, {"content-type": "application/json"})
print(json.load(urllib.request.urlopen(req))["result"])`

const js = (url: string, method: string, params: unknown) => `const res = await fetch("${url}", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "${method}", params: ${JSON.stringify(params)} }),
})
console.log((await res.json()).result)`

export function RawPage() {
  const { t } = useLang()
  const url = rpcSetting.http ?? TIRAMISU_HTTP
  const [shop, setShop] = useState("SYN-BR-0042")
  const [rows, setRows] = useState<Captured[]>([])
  const [lang, setLang] = useState<"curl" | "js" | "py">("curl")
  useEffect(() => {
    if (!/^SYN-[A-Z]{2}-\d{4}$/.test(shop)) return
    void Promise.all(QUERIES.map(async (q) => ({ ...(await capture((r) => q.run(r, shop))), id: q.id }))).then((all) => setRows(all.filter((x): x is Captured => !!x.method)))
  }, [shop])
  return (
    <section class="card raw-page">
      <h2>{t("rawTitle")}</h2>
      <p class="small">{t("rawHelp")}</p>
      <div class="row wrap">
        <label class="inline">
          {t("shop")} <input class="mono" value={shop} onInput={(e) => setShop(e.currentTarget.value.trim().toUpperCase())} size={14} />
        </label>
        {(["curl", "js", "py"] as const).map((l) => (
          <button class={`chip ${lang === l ? "selected" : ""}`} aria-pressed={lang === l} onClick={() => setLang(l)}>
            {l === "curl" ? "curl" : l === "js" ? "JavaScript" : "Python"}
          </button>
        ))}
      </div>
      <p class="small muted mono">{url}</p>
      {rows.map((r) => {
        const code = lang === "curl" ? curlFor(url, r.method, r.params) : lang === "js" ? js(url, r.method, r.params) : python(url, r.method, r.params)
        return (
          <details class="raw-q">
            <summary>
              <strong>{t(`raw_${r.id}` as Key)}</strong>
            </summary>
            <pre class="code">{code}</pre>
            <button class="linkish small" onClick={() => void navigator.clipboard?.writeText(code)}>
              {t("copyCurl").replace("curl", lang === "curl" ? "curl" : lang === "js" ? "JavaScript" : "Python")}
            </button>
          </details>
        )
      })}
      <p class="small">
        {t("rawMore")}{" "}
        <a href="https://github.com/amannx21/Tolmol/blob/main/arkiv/schema.md" target="_blank" rel="noopener">
          arkiv/schema.md
        </a>{" "}
        ·{" "}
        <a href="https://github.com/amannx21/Tolmol/blob/main/examples/tolmol_reader.py" target="_blank" rel="noopener">
          examples/tolmol_reader.py
        </a>{" "}
        · <a href="mirror.html">mirror.html</a>
      </p>
    </section>
  )
}
