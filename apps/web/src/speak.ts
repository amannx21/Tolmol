// Read-aloud with the phone's built-in text-to-speech (Web Speech API). No server, works offline once
// loaded. If the phone has no Hindi voice, it falls back to any available voice or stays silent.
import type { Lang } from "./i18n"

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window

export function speak(text: string, lang: Lang) {
  if (!canSpeak() || !text) return
  try {
    const synth = window.speechSynthesis
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang === "hi" ? "hi-IN" : "en-IN"
    const voice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith(lang === "hi" ? "hi" : "en-in"))
    if (voice) u.voice = voice
    u.rate = 0.9
    synth.speak(u)
  } catch {
    /* speech is a convenience; never block the flow */
  }
}

export const stopSpeaking = () => {
  if (canSpeak()) window.speechSynthesis.cancel()
}
