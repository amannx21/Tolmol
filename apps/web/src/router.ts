import { useEffect, useState } from "preact/hooks"

/** Hash routes work on any static host with no server rewrites: #/report, #/shop/SYN-BR-0042, #/r/0xabc… */
export type Route =
  | { name: "home" }
  | { name: "report"; shopId?: string; view?: "easy" | "full" }
  | { name: "dashboard"; state?: string }
  | { name: "shop"; shopId: string; month?: string; atBlock?: string; letter?: "rti" | "complaint" }
  | { name: "verify" }
  | { name: "r"; key: string }
  | { name: "about" }

export function parse(hash: string): Route {
  const [path = "", query = ""] = hash.replace(/^#/, "").split("?")
  const q = new URLSearchParams(query)
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent)
  switch (parts[0]) {
    case "report":
      return { name: "report", shopId: q.get("shop") ?? undefined, view: q.get("v") === "full" ? "full" : q.get("v") === "easy" ? "easy" : undefined }
    case "dashboard":
      return { name: "dashboard", state: q.get("state") ?? undefined }
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
