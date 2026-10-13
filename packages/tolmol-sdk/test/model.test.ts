import { describe, expect, it } from "vitest"
import { addMonths, kgToGrams, monthToNum, shortfallBp, validateReportInput, ValidationError } from "../src/model.js"

const NOW = new Date("2026-10-13T08:00:00Z")
const ok = { shopId: "SYN-BR-0042", month: "2026-10", item: "rice", entitledG: 25_000, receivedG: 21_000 }

describe("shortfallBp (integer math only)", () => {
  it("computes basis points with floor", () => {
    expect(shortfallBp(25_000, 21_000)).toBe(1600)
    expect(shortfallBp(5_000, 4_500)).toBe(1000)
    expect(shortfallBp(35_000, 0)).toBe(10_000)
    expect(shortfallBp(35_000, 35_000)).toBe(0)
    // 1 g short of 3 kg: 3.333... bp floors to 3
    expect(shortfallBp(3_000, 2_999)).toBe(3)
  })
  it("never produces floating point", () => {
    for (let e = 1; e < 3000; e += 7) for (let r = 0; r <= e; r += 13) expect(Number.isInteger(shortfallBp(e, r))).toBe(true)
  })
  it("rejects non-integers and impossible values", () => {
    expect(() => shortfallBp(5000.5, 100)).toThrow(ValidationError)
    expect(() => shortfallBp(0, 0)).toThrow(ValidationError)
    expect(() => shortfallBp(5000, 5001)).toThrow(ValidationError)
    expect(() => shortfallBp(5000, -1)).toThrow(ValidationError)
  })
})

describe("kgToGrams", () => {
  it("parses what a person types", () => {
    expect(kgToGrams("5")).toBe(5000)
    expect(kgToGrams("4.5")).toBe(4500)
    expect(kgToGrams(" 35 ")).toBe(35000)
    expect(kgToGrams("0.125")).toBe(125)
  })
  it("rejects anything that is not a plain number", () => {
    for (const bad of ["", "abc", "-1", "1e3", "4,5", "1.2345", "9876543210", "5 kg"]) expect(() => kgToGrams(bad)).toThrow()
  })
})

describe("months", () => {
  it("converts and shifts", () => {
    expect(monthToNum("2026-10")).toBe(202610)
    expect(addMonths("2026-01", -1)).toBe("2025-12")
    expect(addMonths("2026-10", -12)).toBe("2025-10")
    expect(() => monthToNum("2026-13")).toThrow()
  })
})

describe("validateReportInput", () => {
  it("accepts a valid report", () => {
    expect(validateReportInput(ok, NOW)).toEqual(ok)
  })
  it("rejects future and stale months", () => {
    expect(() => validateReportInput({ ...ok, month: "2026-11" }, NOW)).toThrow(/future/)
    expect(() => validateReportInput({ ...ok, month: "2025-09" }, NOW)).toThrow(/12 months/)
    expect(validateReportInput({ ...ok, month: "2025-10" }, NOW).month).toBe("2025-10")
  })
  it("rejects bad quantities", () => {
    expect(() => validateReportInput({ ...ok, receivedG: 26_000 }, NOW)).toThrow(/receivedG/)
    expect(() => validateReportInput({ ...ok, entitledG: 0 }, NOW)).toThrow(/entitledG/)
    expect(() => validateReportInput({ ...ok, entitledG: 100_001, receivedG: 0 }, NOW)).toThrow(/entitledG/)
    expect(() => validateReportInput({ ...ok, receivedG: 2.5 }, NOW)).toThrow(/receivedG/)
    expect(() => validateReportInput({ ...ok, receivedG: "21000" }, NOW)).toThrow(/receivedG/)
  })
  it("rejects unknown items", () => {
    expect(() => validateReportInput({ ...ok, item: "sugar" }, NOW)).toThrow(/item/)
  })
})

describe("PII rejection", () => {
  it("rejects any extra field, so free text cannot ride along", () => {
    for (const extra of [
      { name: "Sunita Devi" },
      { phone: "+91 98765 43210" },
      { aadhaar: "1234 5678 9012" },
      { rationCard: "BR-1234567890" },
      { note: "dealer gave less" },
      { photo: "data:image/png;base64,AAAA" },
    ]) {
      expect(() => validateReportInput({ ...ok, ...extra }, NOW)).toThrow(/not a report field/)
    }
  })
  it("only accepts synthetic shop IDs, so a real ID, phone or card number cannot be used as one", () => {
    for (const shopId of ["9876543210", "BR-1234567890", "123456789012", "FPS/Gaya/42", "SYN-BR-42", "syn-br-0042", "SYN-BR-0042 Sunita"]) {
      expect(() => validateReportInput({ ...ok, shopId }, NOW)).toThrow(/shopId/)
    }
  })
  it("rejects non-object input", () => {
    expect(() => validateReportInput("SYN-BR-0042", NOW)).toThrow()
    expect(() => validateReportInput(null, NOW)).toThrow()
    expect(() => validateReportInput([ok], NOW)).toThrow()
  })
})
