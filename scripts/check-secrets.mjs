// Pre-commit secret check. Fails if any staged file (or, with --all, any tracked file) contains:
//  - one of the actual private keys from .env or .seed-wallets.json (with or without 0x), or
//  - an assignment like FOO_PRIVATE_KEY=0x<64 hex> / "privateKey": "0x<64 hex>".
// Entity keys and tx hashes look like private keys (0x + 64 hex), so a blind regex is useless here;
// comparing against the real local keys is exact.
import { execSync } from "node:child_process"
import fs from "node:fs"

const all = process.argv.includes("--all")
const known = new Set()
if (fs.existsSync(".env")) for (const m of fs.readFileSync(".env", "utf8").matchAll(/0x([0-9a-fA-F]{64})/g)) known.add(m[1].toLowerCase())
if (fs.existsSync(".seed-wallets.json")) for (const k of JSON.parse(fs.readFileSync(".seed-wallets.json", "utf8")).keys ?? []) known.add(String(k).slice(2).toLowerCase())

const files = execSync(all ? "git ls-files" : "git diff --cached --name-only --diff-filter=ACMR", { encoding: "utf8" }).split("\n").filter(Boolean)
const forbiddenFiles = files.filter((f) => /(^|\/)\.env($|\.)(?!example)|\.seed-wallets\.json$|\.pem$|id_rsa/.test(f))
const assign = /(private[_-]?key|secret|mnemonic|seed[_-]?phrase)["']?\s*[:=]\s*["']?(0x)?[0-9a-fA-F]{64}/i
const hits = []
for (const f of files) {
  if (!fs.existsSync(f) || fs.statSync(f).size > 5_000_000) continue
  const text = all ? fs.readFileSync(f, "utf8") : execSync(`git show :"${f}"`, { encoding: "utf8", maxBuffer: 50_000_000 })
  const lower = text.toLowerCase()
  for (const k of known) if (lower.includes(k)) hits.push(`${f}: contains a local private key`)
  text.split("\n").forEach((line, i) => {
    if (assign.test(line) && !/\.example$/.test(f)) hits.push(`${f}:${i + 1}: looks like a private key assignment`)
  })
}
for (const f of forbiddenFiles) hits.push(`${f}: secret file must never be committed`)
if (hits.length) {
  console.error("Secret check FAILED:\n  " + [...new Set(hits)].join("\n  "))
  process.exit(1)
}
console.log(`Secret check passed (${files.length} files, ${known.size} local keys compared).`)
