// "Prove this report is mine", in person, without making anything new public. At a hearing an official reads out a
// one-time code; the reporter's phone signs "I created report K, code C, time T" with the key that created the report;
// the official checks the signature against the report's $creator on Arkiv. Nothing is written to Arkiv, and the proof
// says nothing about the person: only that whoever holds this phone wrote that report. It also works for reports sent
// from a separate ID, because the phone keeps those keys.
import { recoverMessageAddress, type Hex } from "viem"
import { getReport, type Reader } from "./queries.js"
import type { Report } from "./model.js"

export type ReportProof = { v: 1; k: Hex; c: string; t: number; s: Hex }
/** A proof older than this is refused (the code is one-time and short-lived). */
export const PROOF_MAX_AGE_S = 15 * 60

export const proofMessage = (reportKey: string, code: string, t: number) => `Tolmol: I created report ${reportKey.toLowerCase()}\ncode ${code}\ntime ${t}`

/** A 6-digit one-time code for the official to read out. */
export function proofCode(): string {
  const r = new Uint32Array(1)
  crypto.getRandomValues(r)
  return String(r[0]! % 1_000_000).padStart(6, "0")
}

export const encodeProof = (p: ReportProof) => btoa(JSON.stringify(p)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
export function decodeProof(s: string): ReportProof | null {
  try {
    const p = JSON.parse(atob(s.trim().replace(/-/g, "+").replace(/_/g, "/"))) as Partial<ReportProof>
    if (p.v !== 1 || typeof p.k !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(p.k)) return null
    if (typeof p.c !== "string" || !/^\d{6}$/.test(p.c) || typeof p.t !== "number" || !Number.isSafeInteger(p.t)) return null
    if (typeof p.s !== "string" || !/^0x[0-9a-fA-F]{130}$/.test(p.s)) return null
    return { v: 1, k: p.k as Hex, c: p.c, t: p.t, s: p.s as Hex }
  } catch {
    return null
  }
}

/** The reporter's side: sign with the key that created the report (any viem local account). */
export async function makeProof(account: { signMessage: (a: { message: string }) => Promise<Hex> }, reportKey: Hex, code: string, now = Date.now()): Promise<ReportProof> {
  if (!/^\d{6}$/.test(code)) throw new Error("the code has 6 digits")
  const t = Math.floor(now / 1000)
  return { v: 1, k: reportKey, c: code, t, s: await account.signMessage({ message: proofMessage(reportKey, code, t) }) }
}

export type ProofCheck =
  | { ok: true; report: Report; signer: Hex; fresh: boolean; codeMatches: boolean | null }
  | { ok: false; reason: "bad_proof" | "no_report" | "not_creator"; signer?: Hex }

/**
 * The official's side. ok = the signer is the report's $creator on Arkiv. `fresh` = signed within 15 minutes;
 * `codeMatches` = the code is the one this official issued (null when the caller did not say which code).
 */
export async function checkProof(reader: Reader, p: ReportProof, o: { expectCode?: string; now?: number } = {}): Promise<ProofCheck> {
  let signer: Hex
  try {
    signer = await recoverMessageAddress({ message: proofMessage(p.k, p.c, p.t), signature: p.s })
  } catch {
    return { ok: false, reason: "bad_proof" }
  }
  const report = await getReport(reader, p.k)
  if (!report) return { ok: false, reason: "no_report", signer }
  if (report.creator.toLowerCase() !== signer.toLowerCase()) return { ok: false, reason: "not_creator", signer }
  const age = Math.floor((o.now ?? Date.now()) / 1000) - p.t
  return { ok: true, report, signer, fresh: age >= -60 && age <= PROOF_MAX_AGE_S, codeMatches: o.expectCode === undefined ? null : o.expectCode === p.c }
}
