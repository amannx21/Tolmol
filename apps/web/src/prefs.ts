// Per-device display preferences: Easy or Full mode, read-aloud on/off, and the user's own shop.
// Stored only in this browser. Nothing here is ever sent anywhere or written to Arkiv.
import { useEffect, useState } from "preact/hooks"

export type Mode = "easy" | "full"
export type Theme = "light" | "dark"
export type Prefs = { mode: Mode; voice: boolean; myShop: string | null; chosen: boolean; separateIds: boolean; theme: Theme }

const KEY = "tolmol.prefs.v1"
const DEFAULTS: Prefs = { mode: "easy", voice: true, myShop: null, chosen: false, separateIds: false, theme: "light" }
const listeners = new Set<(p: Prefs) => void>()

function load(): Prefs {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Prefs>) }
  } catch {
    return { ...DEFAULTS }
  }
}
let current = load()

/** Light unless the person chose dark, whatever the phone's own setting. */
function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t === "dark" ? "dark" : "light"
}
applyTheme(current.theme)

export function setPrefs(patch: Partial<Prefs>) {
  current = { ...current, ...patch }
  if (patch.theme) applyTheme(current.theme)
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    /* private mode: keep in memory */
  }
  listeners.forEach((f) => f(current))
}

export const getPrefs = () => current

export function usePrefs(): [Prefs, (patch: Partial<Prefs>) => void] {
  const [p, set] = useState(current)
  useEffect(() => {
    listeners.add(set)
    return () => void listeners.delete(set)
  }, [])
  return [p, setPrefs]
}
