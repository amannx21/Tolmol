import { useEffect, useRef, useState } from "preact/hooks"
import { formatKg, kgToGrams } from "tolmol-sdk"
import { useLang } from "./i18n"

const numberText = (grams: number) => formatKg(grams).replace(" kg", "")

export function AmountPicker({ grams, onChange, onValidityChange, min = 0, max = 100_000 }: {
  grams: number
  onChange: (grams: number) => void
  onValidityChange: (valid: boolean) => void
  min?: number
  max?: number
}) {
  const { t } = useLang()
  const [draft, setDraft] = useState(() => numberText(grams))
  const lastCommitted = useRef(grams)
  const parse = (text: string) => {
    try {
      // Hindi numerals and a decimal comma are accepted without rounding the amount.
      return kgToGrams(text.replace(/[०-९]/g, digit => String(digit.charCodeAt(0) - 0x0966)).replace(",", "."))
    } catch {
      return null
    }
  }
  const parsed = parse(draft)
  const valid = parsed !== null && parsed >= min && parsed <= max

  useEffect(() => {
    if (grams !== lastCommitted.current) {
      lastCommitted.current = grams
      setDraft(numberText(grams))
    }
    onValidityChange(grams >= min && grams <= max)
  }, [grams, min, max, onValidityChange])

  const adjust = (change: number) => {
    const next = Math.max(min, Math.min(max, grams + change))
    lastCommitted.current = next
    setDraft(numberText(next))
    onValidityChange(true)
    onChange(next)
  }

  return <div class="stepper amount-picker">
    <label class="amount-label" for="ration-amount">{t("amountLabel")}</label>
    <div class="amount-entry"><input id="ration-amount" class="amount-input" type="text" inputMode="decimal" autocomplete="off" value={draft} aria-invalid={!valid} aria-describedby="ration-amount-help" onFocus={event => event.currentTarget.select()} onInput={event => {
      const text = event.currentTarget.value
      setDraft(text)
      const value = parse(text)
      const accepted = value !== null && value >= min && value <= max
      onValidityChange(accepted)
      if (accepted) {
        lastCommitted.current = value
        onChange(value)
      }
    }} onBlur={() => { if (valid && parsed !== null) setDraft(numberText(parsed)) }} /><span class="amount-unit">{t("kg")}</span></div>
    <p id="ration-amount-help" class={`amount-help ${valid ? "muted" : "err"}`} aria-live="polite">{valid ? t("amountHelp") : parsed === null ? t("amountInvalid") : t("amountRange", { min: numberText(min), max: numberText(max) })}</p>
    <div class="amount-buttons"><button type="button" class="secondary" onClick={() => adjust(-1000)} disabled={valid && grams <= min}><span aria-hidden="true">−</span>{t("amountLess")}</button><button type="button" onClick={() => adjust(1000)} disabled={valid && grams >= max}><span aria-hidden="true">+</span>{t("amountMore")}</button></div>
  </div>
}
