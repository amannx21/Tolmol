// Read-aloud with the device's own text-to-speech (Web Speech API). No server; works offline with a voice installed on
// the device. Laptops behave differently from phones, and three browser quirks are handled here: the list of voices
// arrives a moment after the page loads, Chrome's online voices stop after about 15 seconds of speech, and Chrome can
// drop speech started right after a cancel. If the browser has no Hindi voice at all, a note on screen says so (see
// VoiceNote in main.tsx) instead of an English voice failing silently on Hindi text.
import { useEffect, useState } from "preact/hooks"
import type { Lang } from "./i18n"

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window

let voices: SpeechSynthesisVoice[] = []
if (canSpeak()) {
  voices = window.speechSynthesis.getVoices()
  window.speechSynthesis.addEventListener?.("voiceschanged", () => {
    voices = window.speechSynthesis.getVoices()
    if (missing && pickVoice("hi")) setMissing(false) // a Hindi voice arrived after all
  })
}

/** Chrome lists its device voices first and adds its online voices (Google हिन्दी among them) a moment later. */
function moreVoices(): Promise<void> {
  return new Promise((done) => {
    const synth = window.speechSynthesis
    const finish = () => {
      voices = synth.getVoices()
      synth.removeEventListener?.("voiceschanged", finish)
      done()
    }
    synth.addEventListener?.("voiceschanged", finish)
    setTimeout(finish, 2000)
  })
}

/** The voice list, waiting briefly for it when the browser has not filled it in yet. */
function voicesReady(): Promise<void> {
  if (voices.length) return Promise.resolve()
  return new Promise((done) => {
    const synth = window.speechSynthesis
    const finish = () => {
      voices = synth.getVoices()
      synth.removeEventListener?.("voiceschanged", finish)
      done()
    }
    synth.addEventListener?.("voiceschanged", finish)
    setTimeout(finish, 1500)
  })
}

/** The best voice for the language: the Indian regional voice first (hi-IN, en-IN), and one on the device before an
 *  online one (it also works without internet). */
function pickVoice(lang: Lang): SpeechSynthesisVoice | null {
  const want = lang === "hi" ? "hi" : "en"
  const tag = (v: SpeechSynthesisVoice) => (v.lang ?? "").toLowerCase().replace("_", "-")
  const rank = (v: SpeechSynthesisVoice) => (tag(v) === `${want}-in` ? 0 : 2) + (v.localService ? 0 : 1)
  return voices.filter((v) => tag(v).startsWith(want)).sort((a, b) => rank(a) - rank(b))[0] ?? null
}

/** Sentence-sized parts, so Chrome's online voices never reach their 15-second cut-off. */
function parts(text: string): string[] {
  // (No lookbehind: iPhones before iOS 16.4 cannot parse it, and one such pattern stops the whole app.)
  return (text.match(/[^।.!?]+[।.!?]*/g) ?? [text])
    .flatMap((s) => (s.length > 220 ? (s.match(/[^,;:]+[,;:]*/g) ?? [s]) : [s]))
    .map((s) => s.trim())
    .filter(Boolean)
}

// "This browser has no Hindi voice": shown on screen until something is read aloud successfully.
let missing = false
const listeners = new Set<(v: boolean) => void>()
function setMissing(v: boolean) {
  if (v === missing) return
  missing = v
  listeners.forEach((f) => f(v))
}
export function useVoiceMissing(): boolean {
  const [v, setV] = useState(missing)
  useEffect(() => {
    listeners.add(setV)
    return () => void listeners.delete(setV)
  }, [])
  return v
}

let latest = 0
export function speak(text: string, lang: Lang) {
  if (!text) return
  if (!canSpeak()) return setMissing(lang === "hi")
  const mine = ++latest
  const synth = window.speechSynthesis
  const busy = synth.speaking || synth.pending
  synth.cancel()
  let waited = false
  const say = () => {
    if (mine !== latest) return // a newer request replaced this one
    const voice = pickVoice(lang)
    // The browser lists voices and none is Hindi: an English voice would read Hindi as silence or gibberish, so say so,
    // after giving the browser a moment to add its online voices. An empty list proves nothing: some Android browsers
    // never fill it in, yet speak Hindi when asked by language.
    if (!voice && lang === "hi" && voices.length > 0) {
      if (!waited) {
        waited = true
        void moreVoices().then(say)
        return
      }
      return setMissing(true)
    }
    setMissing(false)
    try {
      synth.resume() // Chrome can be left paused
      for (const part of parts(text)) {
        const u = new SpeechSynthesisUtterance(part)
        u.lang = voice?.lang ?? (lang === "hi" ? "hi-IN" : "en-IN")
        if (voice) u.voice = voice
        u.rate = 0.9
        synth.speak(u)
      }
    } catch {
      /* speech is a convenience; never block the flow */
    }
  }
  // Speak at once when possible (some phones only allow speech straight from a tap); otherwise wait for the voices,
  // and leave Chrome a moment after a cancel so it does not drop the new speech.
  if (!voices.length) void voicesReady().then(say)
  else if (busy) setTimeout(say, 80)
  else say()
}

export const stopSpeaking = () => {
  latest++
  if (canSpeak()) window.speechSynthesis.cancel()
}
