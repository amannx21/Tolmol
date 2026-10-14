// Generates docs/ARKIV_USAGE.md: each Arkiv feature Tolmol uses, why, and a commit permalink to the exact lines.
// Usage: node scripts/gen-arkiv-usage.mjs [<commit-sha>]   (defaults to HEAD; rerun on the final commit)
import { execSync } from "node:child_process"
import fs from "node:fs"

const sha = process.argv[2] ?? execSync("git rev-parse HEAD", { encoding: "utf8" }).trim()
const REPO = "https://github.com/amannx21/Tolmol"

// [feature, why, file, first-line regex, number of lines to include]
const FEATURES = [
  ["Typed attributes (report)", "Everything a reader filters on is a typed, indexed attribute: integer grams, basis points, u64 time. Payload is empty: no free text. Issues are a 7-bit i32, time is rounded to the day.", "packages/tolmol-sdk/src/attributes.ts", /export function reportAttributes/, 25],
  ["Typed attributes (witness, key reference)", "A witness points at its report with a `key` attribute, Arkiv's foreign key.", "packages/tolmol-sdk/src/attributes.ts", /export function witnessAttributes/, 17],
  ["Strict parsing of what others wrote", "Anyone can write our attributes, so every type and derived number is re-checked on read.", "packages/tolmol-sdk/src/attributes.ts", /export function parseReport/, 50],
  ["Pinned, paginated walks (cursor + atBlock)", "All pages of one query are read at one block, 200 per page, with next().", "packages/tolmol-sdk/src/queries.ts", /async function walk</, 29],
  ["createdBy(): trusted registry", "Only shops created by the registry wallet appear in the picker.", "packages/tolmol-sdk/src/queries.ts", /export function listShops/, 10],
  ["Compound + range query (dashboard)", "state AND month_num range AND optional shortfall_bp threshold.", "packages/tolmol-sdk/src/queries.ts", /export function dashboardReports/, 15],
  ["createdBy(): per-device dedupe", "One report per device, shop, month and grain.", "packages/tolmol-sdk/src/queries.ts", /export async function myExistingReport/, 6],
  ["Creation flags", "readonly: nobody edits; permissionlessExtension: anyone can keep evidence alive.", "packages/tolmol-sdk/src/writes.ts", /const FLAGS =/, 1],
  ["Atomic batch: create + ownership transfer to 0x…dEaD", "Nobody, not even the reporter, can delete a report. predictEntityKeys lets the same batch reference the new key.", "packages/tolmol-sdk/src/writes.ts", /const \[predicted\] = await reader.predictEntityKeys\(\{ owner: me, count: 1 \}\)\n {2}if/, 23],
  ["Lifetime Extension as a lease renewed by corroboration", "The 2nd distinct witness extends the report and its witnesses in the same batch as the witness create.", "packages/tolmol-sdk/src/writes.ts", /const extensions = target/, 25],
  ["Extension target rule", "max(current, head + 180 days), capped at created + 365 days, never shorter.", "packages/tolmol-sdk/src/rules.ts", /export function extensionTarget/, 11],
  ["Entity Expiration per type", "Shop 180 days, report 90 days by default, corroborated 180, cap 365.", "packages/tolmol-sdk/src/constants.ts", /export const LIFETIME_DAYS/, 8],
  ["Expiry the user controls", "The reporter picks 30, 90 or 180 days and whether others may extend (the permissionlessExtension flag).", "packages/tolmol-sdk/src/writes.ts", /expires: ExpirationTime.fromDays\(lifetimeDays\)/, 2],
  ["Creation flags read back", "Reads select creationFlags, so a witness never tries to extend a report whose reporter opted out.", "packages/tolmol-sdk/src/queries.ts", /const META = /, 1],
  ["Withdrawal as a sealed entity", "A reporter's mistake is withdrawn by a new readonly entity, burned in the same batch; the report itself stays.", "packages/tolmol-sdk/src/writes.ts", /export async function withdrawReport/, 26],
  ["$creator + creation blocks: burst patterns", "3+ different creators within 30 blocks at one shop are flagged on every shop page and can be left out of the dashboard.", "packages/tolmol-sdk/src/rules.ts", /export function rapidGroups/, 20],
  ["$creator for privacy: a separate ID per report", "Optional: each report is created by a fresh key funded by the relayer, so creators cannot be linked.", "apps/web/src/arkiv.ts", /export async function fileReport/, 40],
  ["$creator on both sides: shop answers and reporter follow-ups", "An answer counts only from that shop's verified dealer; 'fixed' only from the report's own device.", "packages/tolmol-sdk/src/answers.ts", /export function validResponses/, 14],
  ["Sealed answers: create + transfer to 0x…dEaD in one batch", "Neither the dealer nor the reporter can take back what they said.", "packages/tolmol-sdk/src/answers.ts", /async function sealed/, 20],
  ["createdBy() chain of trust: verified card holders", "Registry names verifiers; a device counts as verified only by an attestation from a named verifier, one device per card.", "packages/tolmol-sdk/src/verify.ts", /export function verifiedDevices/, 15],
  ["Verifier: 'card already used' checked on Arkiv", "The verifier queries card_tag createdBy(itself) before writing, so its memory is Arkiv, not a database.", "apps/relayer/src/verifier.ts", /const tag = await cardTag/, 8],
  ["$creator: withdrawals only from the reporter", "A tolmol.correction counts only when its $creator wrote the report.", "packages/tolmol-sdk/src/rules.ts", /export function withdrawnKeys/, 8],
  ["$creator: different-witness rule and dedupe", "Witness must be a different creator; one per creator; earliest by block then key.", "packages/tolmol-sdk/src/rules.ts", /export function dedupeReports/, 28],
  ["WebSocket entity events", "watchEntityEvents on a webSocket() transport, no fromBlock: pushed, not polled. Only burn transfers are fetched.", "packages/tolmol-sdk/src/live.ts", /export function watchTolmol/, 50],
  ["WebSocket client", "The live reader uses viem's webSocket transport with reconnect and keep-alive.", "packages/tolmol-sdk/src/clients.ts", /export function wsReader/, 3],
  ["Live dashboard in the UI", "New reports and witnesses merge into the ranking without a refresh.", "apps/web/src/Dashboard.tsx", /Live: pushed over WebSocket/, 30],
  ["atBlock evidence view in the UI", "'Show as it was at block N' on every shop page and in exports.", "apps/web/src/ShopPage.tsx", /const at = atBlock/, 7],
  ["$creator shown in the UX", "Every report and witness shows its device address with an explorer link.", "apps/web/src/ReportView.tsx", /<dt>\{t\("reporter"\)\}<\/dt>/, 8],
  ["Device-signed writes from the browser", "A keypair generated in the browser signs; no server signer, so $creator is per device.", "apps/web/src/arkiv.ts", /export function device\(\)/, 21],
  ["Batch size kept under the RPC limit", "At most 40 creates per batch (friction F5).", "scripts/seed.ts", /for \(let i = 0; i < missing.length; i \+= MAX_CREATES_PER_BATCH\)/, 13],
]

const rows = []
for (const [feature, why, file, re, n] of FEATURES) {
  const text = execSync(`git show ${sha}:${file}`, { encoding: "utf8" })
  const m = re.exec(text)
  if (!m) throw new Error(`pattern not found in ${file} at ${sha}: ${re}`)
  const start = text.slice(0, m.index).split("\n").length
  const end = start + n - 1
  rows.push(`| ${feature} | ${why} | [\`${file}#L${start}-L${end}\`](${REPO}/blob/${sha}/${file}#L${start}-L${end}) |`)
}

const out = `# How Tolmol uses Arkiv (with code permalinks)

Generated by \`node scripts/gen-arkiv-usage.mjs\` at commit [\`${sha.slice(0, 7)}\`](${REPO}/commit/${sha}).
Every link points at that exact commit, so it stays valid after later changes.

| Feature | How and why | Code |
|---|---|---|
${rows.join("\n")}

What we deliberately did **not** use: \`patchEntity\` (reports are readonly by design), \`deleteEntity\` (nobody should
be able to delete evidence), access keys (reads come from each visitor's own browser), and \`fromBlock\` on the
watcher (it would force polling).
`
fs.writeFileSync("docs/ARKIV_USAGE.md", out)
console.log(`wrote docs/ARKIV_USAGE.md for ${sha} (${rows.length} features)`)
