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
    if (missing && pickVoice("hi")) {
      // A Hindi voice arrived after all: clear the note and read what the person last asked for, if it was just now.
      setMissing(false)
      const p = pendingHindi
      pendingHindi = null
      if (p && Date.now() - p.at < 15_000) speak(p.text, "hi")
    }
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
    setTimeout(finish, 4000)
  })
}

/** The voice list, waiting briefly for it when the browser has not filled it in yet. */
function voicesReady(ms = 1500): Promise<void> {
  if (voices.length) return Promise.resolve()
  return new Promise((done) => {
    const synth = window.speechSynthesis
    const finish = () => {
      voices = synth.getVoices()
      synth.removeEventListener?.("voiceschanged", finish)
      done()
    }
    synth.addEventListener?.("voiceschanged", finish)
    setTimeout(finish, ms)
  })
}

/**
 * Phones read aloud well with their own speech engine, so on a phone Tolmol keeps the simple choice it always made:
 * the phone's first voice of the language, the whole text in one go, no waiting. The careful choosing below is for
 * laptop browsers, where the voice list arrives late and may hold no Hindi voice at all.
 */
const onPhone = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
function phoneVoice(lang: Lang): SpeechSynthesisVoice | null {
  const want = lang === "hi" ? "hi" : "en-in"
  return window.speechSynthesis.getVoices().find((v) => (v.lang ?? "").toLowerCase().replace("_", "-").startsWith(want)) ?? null
}

/** The best voice for the language: the Indian regional voice first (hi-IN, en-IN), and one on the device before an
 *  online one (it also works without internet). */
function pickVoice(lang: Lang): SpeechSynthesisVoice | null {
  const want = lang === "hi" ? "hi" : "en"
  const tag = (v: SpeechSynthesisVoice) => (v.lang ?? "").toLowerCase().replace("_", "-")
  const rank = (v: SpeechSynthesisVoice) => (tag(v) === `${want}-in` ? 0 : 2) + (v.localService ? 0 : 1)
  return voices.filter((v) => tag(v).startsWith(want)).sort((a, b) => rank(a) - rank(b))[0] ?? null
}

/**
 * What to hand the voice in one go. A voice on the device reads the whole text at once, as a person would: splitting
 * makes it stop and start after every sentence. Chrome's online voices stop after about 15 seconds, so for them the
 * text goes in chunks of a few sentences, split only where a sentence really ends (a full stop followed by a space,
 * never inside "37.6" or "Rs."-style numbers).
 */
function parts(text: string, voice: SpeechSynthesisVoice | null): string[] {
  if (onPhone || voice?.localService) return [text]
  // (No lookbehind: iPhones before iOS 16.4 cannot parse it, and one such pattern stops the whole app.)
  const sentences = text.replace(/([।.!?])\s+/g, "$1\u0001").split("\u0001")
  const chunks: string[] = []
  for (const s of sentences) {
    const last = chunks.length - 1
    if (last >= 0 && chunks[last]!.length + s.length < 180) chunks[last] += " " + s
    else chunks.push(s)
  }
  return chunks.map((c) => c.trim()).filter(Boolean)
}

// "This browser has no Hindi voice": shown on screen until something is read aloud successfully.
let missing = false
// What the person asked to hear while no Hindi voice was there yet (read as soon as one arrives).
let pendingHindi: { text: string; at: number } | null = null
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
/**
 * Hindi as it should be heard. Several laptop Hindi voices read "20" or "37.6%" in English; Devanagari digits, and
 * "प्रतिशत" / "रुपये" for % and ₹, are read in Hindi by every Hindi voice. Only what is spoken changes, not the screen.
 */
export function spokenHindi(text: string): string {
  return text
    .replace(/[0-9]/g, (d) => "०१२३४५६७८९"[Number(d)]!)
    .replace(/₹\s?([०-९][०-९,.]*)/g, "$1 रुपये")
    .replace(/%/g, " प्रतिशत")
}

export function speak(text: string, lang: Lang) {
  if (!text) return
  if (lang === "hi") text = spokenHindi(text)
  if (!canSpeak()) return setMissing(lang === "hi")
  const mine = ++latest
  const synth = window.speechSynthesis
  const busy = synth.speaking || synth.pending
  synth.cancel()
  let waited = false
  const say = () => {
    if (mine !== latest) return // a newer request replaced this one
    const voice = onPhone ? phoneVoice(lang) : pickVoice(lang)
    // The browser lists voices and none is Hindi: an English voice would read Hindi as silence or gibberish, so say so,
    // after giving a laptop browser a moment to add its online voices. An empty list proves nothing: some Android
    // browsers never fill it in, yet speak Hindi when asked by language.
    if (!voice && lang === "hi" && (onPhone ? window.speechSynthesis.getVoices().length : voices.length) > 0) {
      if (!waited && !onPhone) {
        waited = true
        void moreVoices().then(say)
        return
      }
      pendingHindi = { text, at: Date.now() }
      return setMissing(true)
    }
    setMissing(false)
    pendingHindi = null
    try {
      if (!onPhone) synth.resume() // laptop Chrome can be left paused
      for (const part of parts(text, voice)) {
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
  if (!voices.length && !onPhone) void voicesReady().then(say)
  // First tap on a phone: many Android phones drop speech asked for before their engine has listed its voices, so
  // wait for that once (at most 0.8 s). After the first time the list is there and speech starts at once.
  else if (onPhone && !window.speechSynthesis.getVoices().length) {
    voices = []
    void voicesReady(800).then(say)
  } else if (busy && !onPhone) setTimeout(say, 80)
  else say()
}

export const stopSpeaking = () => {
  latest++
  if (canSpeak()) window.speechSynthesis.cancel()
}

// Going to another page stops what the last page was reading, instead of it reading on over the next page.
if (canSpeak()) window.addEventListener("hashchange", stopSpeaking)
