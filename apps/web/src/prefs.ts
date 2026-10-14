// Per-device display preferences: Easy or Full mode, read-aloud on/off, and the user's own shop.
// Stored only in this browser. Nothing here is ever sent anywhere or written to Arkiv.
import { useEffect, useState } from "preact/hooks"

export type Mode = "easy" | "full"
export type Prefs = { mode: Mode; voice: boolean; myShop: string | null; chosen: boolean }

const KEY = "tolmol.prefs.v1"
const DEFAULTS: Prefs = { mode: "easy", voice: true, myShop: null, chosen: false }
const listeners = new Set<(p: Prefs) => void>()

function load(): Prefs {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Prefs>) }
  } catch {
    return { ...DEFAULTS }
  }
}
let current = load()

export function setPrefs(patch: Partial<Prefs>) {
  current = { ...current, ...patch }
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
