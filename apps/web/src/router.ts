import { useEffect, useState } from "preact/hooks"
import { isScheme, type Scheme } from "tolmol-sdk"

/** Hash routes work on any static host with no server rewrites: #/report, #/shop/SYN-BR-0042, #/r/0xabc… */
export type Route =
  | { name: "home" }
  | { name: "report"; shopId?: string; view?: "easy" | "full"; scheme?: Scheme }
  | { name: "dashboard"; state?: string; scheme?: Scheme }
  | { name: "shop"; shopId: string; month?: string; atBlock?: string; letter?: "rti" | "complaint" }
  | { name: "verify" }
  | { name: "r"; key: string }
  | { name: "about" }
  | { name: "card"; c: string }
  | { name: "testCards" }
  | { name: "designPreview" }
  | { name: "me" }
  | { name: "tour" }
  | { name: "proof"; p?: string }
  | { name: "trust" }
  | { name: "raw" }

const schemeParam = (q: URLSearchParams): Scheme | undefined => {
  const s = q.get("scheme")
  return isScheme(s) ? s : undefined
}

export function parse(hash: string): Route {
  const [path = "", query = ""] = hash.replace(/^#/, "").split("?")
  const q = new URLSearchParams(query)
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent)
  switch (parts[0]) {
    case "design-preview":
      return { name: "designPreview" }
    case "me":
      return { name: "me" }
    case "tour":
      return { name: "tour" }
    case "trust":
      return { name: "trust" }
    case "raw":
      return { name: "raw" }
    case "proof":
      return { name: "proof", p: q.get("p") ?? undefined }
    case "report":
      return { name: "report", shopId: q.get("shop") ?? undefined, view: q.get("v") === "full" ? "full" : q.get("v") === "easy" ? "easy" : undefined, scheme: schemeParam(q) }
    case "dashboard":
      return { name: "dashboard", state: q.get("state") ?? undefined, scheme: schemeParam(q) }
    case "shop":
      if (parts[1]) {
        const letter = q.get("letter")
        return { name: "shop", shopId: parts[1], month: q.get("month") ?? undefined, atBlock: q.get("block") ?? undefined, letter: letter === "rti" || letter === "complaint" ? letter : undefined }
      }
      break
    case "r":
      if (parts[1] && /^0x[0-9a-fA-F]{64}$/.test(parts[1])) return { name: "r", key: parts[1] }
      break
    case "about":
      return { name: "about" }
    case "verify":
      return { name: "verify" }
    case "card":
      return { name: "card", c: q.get("c") ?? "" }
    case "test-cards":
      return { name: "testCards" }
  }
  return { name: "home" }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash))
  useEffect(() => {
    const on = () => {
      setRoute(parse(location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener("hashchange", on)
    return () => window.removeEventListener("hashchange", on)
  }, [])
  return route
}

export const go = (hash: string) => {
  location.hash = hash
}
