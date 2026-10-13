// Seeds a clearly-labelled SYNTHETIC dataset on Tiramisu. Idempotent: rerunning skips what already exists.
//
//   npm run seed            (reads REPORTER_PRIVATE_KEY and REGISTRY_PRIVATE_KEY from .env)
//
// - The registry wallet publishes synthetic fair-price shops (SYN-<state>-<nnnn>) in real districts.
// - Ten synthetic "device" wallets (keys in the git-ignored .seed-wallets.json) file reports and corroborate
//   each other, exactly as the app does, through tolmol-sdk. Every entity carries synthetic=true.
// - The reporter wallet only funds the others with small amounts of test GLM.
// - Writes docs/seed-manifest.json with every key, creator and transaction so the evidence outlives expiry.
import fs from "node:fs"
import { ExpirationTime, jsonToPayload } from "@arkiv-network/sdk"
import { createPublicClient, createWalletClient, formatEther, http, parseEther, type LocalAccount } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import {
  addMonths,
  corroborate,
  currentMonth,
  DEFAULT_REGISTRY,
  DuplicateError,
  httpReader,
  LIFETIME_DAYS,
  listShops,
  MAX_CREATES_PER_BATCH,
  myExistingReport,
  NFSA,
  shopAttributes,
  submitReport,
  tiramisu,
  writerFor,
  type Item,
  type Shop,
} from "../packages/tolmol-sdk/src/index.js"

const SEED_FILE = ".seed-wallets.json"
const MANIFEST = "docs/seed-manifest.json"
const DEVICES = 10

// --- Synthetic registry: real district names (public geography), invented shops.
const DISTRICTS: Record<string, [string, string][]> = {
  BR: [["gaya", "गया"], ["patna", "पटना"], ["muzaffarpur", "मुज़फ़्फ़रपुर"], ["darbhanga", "दरभंगा"]],
  UP: [["varanasi", "वाराणसी"], ["gorakhpur", "गोरखपुर"], ["bahraich", "बहराइच"], ["sitapur", "सीतापुर"]],
  JH: [["ranchi", "रांची"], ["dumka", "दुमका"], ["palamu", "पलामू"], ["giridih", "गिरिडीह"]],
}
type SeedShop = { shopId: string; state: string; district: string; labelEn: string; labelHi: string; profile: "fair" | "short" | "bad" }

function synthShops(): SeedShop[] {
  const out: SeedShop[] = []
  for (const [state, ds] of Object.entries(DISTRICTS)) {
    let n = 1
    for (const [district, hi] of ds) {
      for (let j = 0; j < 2; j++) {
        const num = String(n++).padStart(4, "0")
        const en = district[0]!.toUpperCase() + district.slice(1)
        out.push({ shopId: `SYN-${state}-${num}`, state, district, labelEn: `Synthetic FPS ${num}, ${en}`, labelHi: `कृत्रिम राशन दुकान ${num}, ${hi}`, profile: "fair" })
      }
    }
  }
  // The demo shop used in the README and video.
  out.push({ shopId: "SYN-BR-0042", state: "BR", district: "gaya", labelEn: "Synthetic FPS 0042, Gaya", labelHi: "कृत्रिम राशन दुकान 0042, गया", profile: "bad" })
  // Deterministic profiles: some shops are honest, some short, some bad.
  const profiles: SeedShop["profile"][] = ["fair", "short", "bad", "fair", "short", "fair", "bad", "fair"]
  out.forEach((s, i) => {
    if (s.shopId !== "SYN-BR-0042") s.profile = profiles[i % profiles.length]!
  })
  return out
}

// --- Deterministic PRNG so the dataset is reproducible.
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function loadDevices(): LocalAccount[] {
  let keys: string[] = []
  if (fs.existsSync(SEED_FILE)) keys = JSON.parse(fs.readFileSync(SEED_FILE, "utf8")).keys
  while (keys.length < DEVICES) keys.push(generatePrivateKey())
  fs.writeFileSync(SEED_FILE, JSON.stringify({ note: "Synthetic Tiramisu test devices. Never commit.", keys }, null, 2), { mode: 0o600 })
  return keys.map((k) => privateKeyToAccount(k as `0x${string}`))
}

function env(name: string): LocalAccount {
  const k = process.env[name]
  if (!/^0x[0-9a-fA-F]{64}$/.test(k ?? "")) throw new Error(`${name} missing or malformed in .env`)
  return privateKeyToAccount(k as `0x${string}`)
}

/** Runs async jobs with at most `n` in flight. */
async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  const queue = [...items]
  await Promise.all(Array.from({ length: Math.min(n, queue.length) }, async () => {
    for (let t = queue.shift(); t !== undefined; t = queue.shift()) await fn(t)
  }))
}

const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a)

/** Refuses to start if another seed run is alive: two runs share wallets and collide on nonces. */
function takeLock() {
  const LOCK = ".seed.lock"
  if (fs.existsSync(LOCK)) {
    const pid = Number(fs.readFileSync(LOCK, "utf8"))
    try {
      process.kill(pid, 0)
      throw new Error(`another seed run (pid ${pid}) is still running; refusing to start`)
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ESRCH") throw e
    }
  }
  fs.writeFileSync(LOCK, String(process.pid))
  process.on("exit", () => fs.rmSync(LOCK, { force: true }))
}

async function main() {
  takeLock()
  const reader = httpReader()
  const pub = createPublicClient({ chain: tiramisu, transport: http() })
  const funder = env("REPORTER_PRIVATE_KEY")
  const registry = env("REGISTRY_PRIVATE_KEY")
  if (registry.address.toLowerCase() !== DEFAULT_REGISTRY.toLowerCase()) throw new Error("REGISTRY key does not match DEFAULT_REGISTRY")
  const devices = loadDevices()
  const manifest: Record<string, unknown> = {
    note: "SYNTHETIC demo data for Tolmol on Tiramisu (chain 7738577). No real shop, dealer or person.",
    generatedAt: new Date().toISOString(),
    registry: registry.address,
    funder: funder.address,
    devices: devices.map((d) => d.address),
    fundingTxs: [] as string[],
    shopBatches: [] as unknown[],
    reports: [] as unknown[],
    witnesses: [] as unknown[],
  }

  // 1. Fund the registry and devices (plain GLM transfers work on Arkiv; see friction F4).
  const fundW = createWalletClient({ chain: tiramisu, transport: http(), account: funder })
  for (const [acct, target] of [[registry, "0.2"], ...devices.map((d) => [d, "0.03"] as const)] as const) {
    const bal = await pub.getBalance({ address: acct.address })
    if (bal >= parseEther(target) / 2n) continue
    const hash = await fundW.sendTransaction({ to: acct.address, value: parseEther(target) })
    await pub.waitForTransactionReceipt({ hash })
    ;(manifest.fundingTxs as string[]).push(hash)
    log("funded", acct.address, target, "GLM", hash)
  }

  // 2. Synthetic shop registry, in batches of at most 40 creates.
  const shops = synthShops()
  const existing = new Set((await listShops(reader, {})).items.map((s) => s.shopId))
  const missing = shops.filter((s) => !existing.has(s.shopId))
  const regW = writerFor(registry)
  for (let i = 0; i < missing.length; i += MAX_CREATES_PER_BATCH) {
    const chunk = missing.slice(i, i + MAX_CREATES_PER_BATCH)
    const res = await regW.executeBatch({
      creates: chunk.map((s) => ({
        payload: jsonToPayload({ label_en: s.labelEn, label_hi: s.labelHi, synthetic: true }),
        contentType: "application/json",
        attributes: shopAttributes(s),
        expires: ExpirationTime.fromDays(LIFETIME_DAYS.shop),
        flags: { readonly: true, permissionlessExtension: true },
      })),
    })
    ;(manifest.shopBatches as unknown[]).push({ txHash: res.txHash, shops: chunk.map((s, j) => ({ shopId: s.shopId, key: res.createdEntities[j] })) })
    log("published", chunk.length, "synthetic shops", res.txHash)
  }
  const onChain = new Map<string, Shop>((await listShops(reader, {})).items.map((s) => [s.shopId, s]))
  log("registry has", onChain.size, "shops")

  // 3. Reports: each device "lives" near two districts and reports rice and wheat for 3 months.
  const rand = mulberry32(42)
  const months = [addMonths(currentMonth(), -2), addMonths(currentMonth(), -1), currentMonth()]
  const allDistricts = Object.entries(DISTRICTS).flatMap(([st, ds]) => ds.map(([d]) => `${st}:${d}`))
  type Plan = { device: number; shop: SeedShop; month: string; item: Item; entitledG: number; receivedG: number }
  const plans: Plan[] = []
  devices.forEach((_, di) => {
    const home = [allDistricts[di % allDistricts.length]!, allDistricts[(di + 3) % allDistricts.length]!]
    if (di < 3) home.push("BR:gaya") // several devices share the demo shop's district
    const myShops = shops.filter((s) => home.includes(`${s.state}:${s.district}`))
    const members = 2 + Math.floor(rand() * 5) // household size: used only to compute entitlement, never stored
    const aay = rand() < 0.2
    for (const shop of myShops.slice(0, 3)) {
      for (const month of months) {
        if (rand() < 0.25 && shop.shopId !== "SYN-BR-0042") continue
        for (const item of ["rice", "wheat"] as const) {
          // Synthetic split of the NFSA entitlement (PHH 5 kg/person, AAY 35 kg/family) into rice and wheat.
          const total = aay ? NFSA.aayPerFamilyG : NFSA.phhPerPersonG * members
          const entitledG = item === "rice" ? Math.round((total * 3) / 5) : total - Math.round((total * 3) / 5)
          const lossPct = shop.profile === "fair" ? rand() * 0.02 : shop.profile === "short" ? 0.06 + rand() * 0.1 : 0.18 + rand() * 0.2
          const receivedG = Math.max(0, Math.round((entitledG * (1 - lossPct)) / 100) * 100)
          plans.push({ device: di, shop, month, item, entitledG, receivedG })
        }
      }
    }
  })
  log("planned", plans.length, "reports from", devices.length, "devices")

  const writers = devices.map((d) => writerFor(d))
  const filed: { key: `0x${string}`; device: number; shop: SeedShop }[] = []
  // Devices write in parallel (separate wallets, separate nonces); each device writes sequentially.
  await pool(
    devices.map((d, di) => [d, di] as const),
    5,
    async ([d, di]) => {
      for (const p of plans.filter((x) => x.device === di)) {
        const shop = onChain.get(p.shop.shopId)
        if (!shop) throw new Error(`shop ${p.shop.shopId} missing from registry`)
        const input = { shopId: p.shop.shopId, month: p.month, item: p.item, entitledG: p.entitledG, receivedG: p.receivedG }
        try {
          const res = await submitReport(reader, writers[di]!, input, shop, { synthetic: true })
          ;(manifest.reports as unknown[]).push({ ...input, key: res.entityKey, creator: d.address, txHash: res.txHash })
          filed.push({ key: res.entityKey, device: di, shop: p.shop })
          log("report", p.shop.shopId, p.month, p.item, `${p.receivedG}/${p.entitledG} g`, "by device", di)
        } catch (e) {
          if (e instanceof DuplicateError) {
            filed.push({ key: e.existingKey, device: di, shop: p.shop })
            const prev = await myExistingReport(reader, d.address, input)
            ;(manifest.reports as unknown[]).push({ ...input, key: e.existingKey, creator: d.address, existing: true, expiresAt: prev?.expiresAt.toString() })
          } else throw e
        }
      }
    },
  )

  // 4. Witnesses: at short and bad shops, other devices that share the district corroborate.
  // Round r gives each report its r-th witness, so no two devices corroborate the same report at once.
  const witnessPlan = filed
    .filter((f) => f.shop.profile !== "fair")
    .map((f) => {
      const peers = devices.map((_, i) => i).filter((i) => i !== f.device && plans.some((p) => p.device === i && p.shop.district === f.shop.district))
      return { key: f.key, peers: peers.slice(0, f.shop.profile === "bad" ? 2 : 1) }
    })
  for (let round = 0; round < 2; round++) {
    const jobs = new Map<number, `0x${string}`[]>()
    for (const w of witnessPlan) {
      const dev = w.peers[round]
      if (dev !== undefined) jobs.set(dev, [...(jobs.get(dev) ?? []), w.key])
    }
    await pool([...jobs.entries()], 5, async ([wi, keys]) => {
      for (const k of keys) {
        try {
          const res = await corroborate(reader, writers[wi]!, k, { synthetic: true })
          ;(manifest.witnesses as unknown[]).push({ reportKey: k, key: res.entityKey, creator: devices[wi]!.address, txHash: res.txHash, extendedTo: res.extendedTo?.toString() ?? null })
          log("witness round", round + 1, k.slice(0, 10), "by device", wi, res.extendedTo ? `extended to block ${res.extendedTo}` : "")
        } catch (e) {
          if (e instanceof DuplicateError) (manifest.witnesses as unknown[]).push({ reportKey: k, key: e.existingKey, creator: devices[wi]!.address, existing: true })
          else throw e
        }
      }
    })
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n")
  log("done:", (manifest.reports as unknown[]).length, "reports,", (manifest.witnesses as unknown[]).length, "witnesses. Manifest:", MANIFEST)
  log("funder balance now", formatEther(await pub.getBalance({ address: funder.address })), "GLM")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
