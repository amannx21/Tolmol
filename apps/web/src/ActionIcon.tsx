import { createContext } from "preact"
import { useContext } from "preact/hooks"

export const IconStyleContext = createContext<"outline" | "emoji">("outline")

const paths = {
  home: "m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7",
  report: "M7 3h9l4 4v14H4V3h3Zm9 0v5h4M8 12h8M8 16h5",
  shop: "M4 10v10h16V10M3 10l2-6h14l2 6M9 20v-6h6v6M3 10h18",
  listen: "m11 4-6 5H2v6h3l6 5V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14",
  send: "m3 3 19 9-19 9 4-9-4-9Zm4 9h15",
  check: "m5 12 4 4L19 6",
  back: "m12 5-7 7 7 7M5 12h15",
  next: "m12 5 7 7-7 7M4 12h15",
  calendar: "M5 5h14v16H5V5Zm3-3v6m8-6v6M5 10h14m-10 4h2m3 0h2m-7 3h2",
  card: "M3 5h18v14H3V5Zm0 4h18M7 15h4",
  people: "M14 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-4M16 3a4 4 0 0 1 0 8M8 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
  grain: "M12 21V6m0 0c-4-4 0-5 0-5s4 1 0 5Zm0 6c-6 0-7-4-7-6 4 0 7 3 7 6Zm0 5c6 0 7-4 7-6-4 0-7 3-7 6Z",
  share: "M12 16V3m-5 5 5-5 5 5M6 13H3v8h18v-8h-3",
  download: "M12 3v12m-5-5 5 5 5-5M3 16v5h18v-5",
  letter: "M3 5h18v15H3V5Zm0 0 9 8 9-8",
  print: "M6 9V3h12v6M6 17H3V9h18v8h-3M6 14h12v7H6v-7m11-2h1",
  refresh: "M20 7a8 8 0 1 0 0 10M20 3v5h-5",
  save: "M3 3h15l3 3v15H3V3Zm4 0v6h10V3M7 21v-7h10v7",
  undo: "M9 5 3 11l6 6M3 11h12a6 6 0 0 1 6 6",
  id: "M3 5h18v14H3V5Zm5 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm-3 8c0-4 6-4 6 0m3-7h4m-4 4h4",
  dashboard: "M3 21h18M6 17v-6m6 6V3m6 14V7",
  info: "M12 11v6m0-10v.1M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18",
  phone: "M6 3H3v3c0 8 7 15 15 15h3v-5l-5-2-3 3c-3-1-5-3-6-6l3-3-2-5H6Z",
  shield: "M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Zm-4 9 3 3 5-6",
} as const

export type ActionIconName = keyof typeof paths

const emojis: Record<ActionIconName, string> = {
  home: "🏠", report: "📝", shop: "🏪", listen: "🔊", send: "📤",
  check: "✅", back: "⬅️", next: "➡️", calendar: "📅", card: "💳",
  people: "👥", grain: "🌾", share: "📲", download: "📥", letter: "✉️",
  print: "🖨️", refresh: "🔄", save: "💾", undo: "↩️", id: "🪪",
  dashboard: "📊", info: "ℹ️", phone: "📞", shield: "🛡️",
}

/** Icons accompany visible labels; screen readers read the action once. */
export function ActionIcon({ name }: { name: ActionIconName }) {
  const style = useContext(IconStyleContext)
  if (style === "emoji") return <span class="action-icon emoji-icon" aria-hidden="true">{emojis[name]}</span>
  return <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>
}
