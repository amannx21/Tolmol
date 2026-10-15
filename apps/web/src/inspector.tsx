import { useState } from "preact/hooks"
import { TIRAMISU_HTTP } from "tolmol-sdk"
import { rpcSetting } from "./arkiv"
import { useLang } from "./i18n"
import { curlFor, useReads } from "./rpc"

const URL_USED = rpcSetting.http ?? TIRAMISU_HTTP
const ago = (ms: number) => Math.max(1, Math.round((Date.now() - ms) / 60000))

/** Shown when part of the page comes from this phone's saved copy because Arkiv's free read budget ran out. */
export function SavedCopyBanner() {
  const { t } = useLang()
  const r = useReads()
  if (r.savedAt === null) return null
  return (
    <p class="banner saved-copy" role="status">
      {t("savedCopy").replace("{m}", String(ago(r.savedAt)))}
    </p>
  )
}

/** Every Arkiv query this page made, exactly as sent, with its cost: re-run any of them with curl, without this site. */
export function ReadInspector() {
  const { t } = useLang()
  const r = useReads()
  const [copied, setCopied] = useState<number | null>(null)
  const queries = r.log.filter((l) => l.method === "arkiv_query")
  return (
    <details class="inspector">
      <summary>
        {t("inspectorTitle")}: {queries.length}
        {r.spent ? ` · ${t("inspectorCost")} ${r.spent}` : ""}
        {r.remaining !== null && r.limit !== null ? ` · ${t("inspectorLeft")} ${r.remaining}/${r.limit}` : ""}
      </summary>
      <p class="small muted">{t("inspectorHelp")}</p>
      <ol class="inspector-list">
        {r.log.map((l, i) => {
          const p = l.params as unknown[]
          const q = l.method === "arkiv_query" && typeof p?.[0] === "string" ? p[0] : l.method
          return (
            <li key={l.at + ":" + i}>
              <code class="mono small">{q}</code>{" "}
              <span class={`small tag-${l.status}`}>
                {l.status === "live" ? t("inspectorLive") : l.status === "saved" ? t("inspectorSaved") : l.status === "reused" ? t("inspectorReused") : t("inspectorFailed")}
                {l.cost ? ` · ${l.cost}` : ""}
              </span>{" "}
              <button
                class="linkish small"
                onClick={() => {
                  void navigator.clipboard?.writeText(curlFor(URL_USED, l.method, l.params)).then(() => setCopied(i))
                }}
              >
                {copied === i ? t("copied") : t("copyCurl")}
              </button>
            </li>
          )
        })}
      </ol>
    </details>
  )
}
