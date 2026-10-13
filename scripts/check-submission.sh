#!/usr/bin/env bash
# Pre-submission gate check. Run from the repo root: bash scripts/check-submission.sh
# Exits non-zero if any check fails. Network checks hit GitHub, the live URL and the Arkiv RPC
# (anonymously, or with ARKIV_ACCESS_KEY if set; each wallet check costs one 100-unit query).
set -u
fail=0
ok() { printf '  PASS  %s\n' "$1"; }
bad() { printf '  FAIL  %s\n' "$1"; fail=1; }
check() { if eval "$2" >/dev/null 2>&1; then ok "$1"; else bad "$1"; fi; }

echo "Files"
check "LICENSE is MIT" "grep -q 'MIT License' LICENSE"
check "arkiv/schema.md exists and has > 40 lines" "[ \$(wc -l < arkiv/schema.md) -gt 40 ]"
check "arkiv/friction.md exists and has > 40 lines" "[ \$(wc -l < arkiv/friction.md) -gt 40 ]"
check "arkiv/wallets.md exists and lists > 5 addresses" "[ \$(grep -cE '0x[0-9a-fA-F]{40}\b' arkiv/wallets.md) -gt 5 ]"
check "README has a live URL (no [FILL] on the Live app line)" "grep -E '^\| Live app \|' README.md | grep -q 'https://' && ! grep -E '^\| Live app \|' README.md | grep -q FILL"
check "README has a video link" "grep -E '^\| Demo video' README.md | grep -q 'https://'"

echo "Secrets"
check ".env is not tracked" "[ -z \"\$(git ls-files .env .seed-wallets.json)\" ]"
check ".env never appears in history" "[ -z \"\$(git log --all --format=%H -- .env .seed-wallets.json)\" ]"
check "no local private key in tracked files" "node scripts/check-secrets.mjs --all"
check "no private key in any commit" "! git log --all -p | grep -iE '(private[_-]?key|secret|mnemonic)[\"'\'']?[[:space:]]*[:=][[:space:]]*[\"'\'']?(0x)?[0-9a-f]{64}'"

echo "Arkiv usage"
check "SDK is imported and queried in source" "grep -rq 'select(' packages/tolmol-sdk/src && grep -rq '@arkiv-network/sdk' packages/tolmol-sdk/src"
node --input-type=module -e "
const rpc='https://rpc.tiramisu.db-chain.testnet.arkiv.network'
const wallets=[...new Set((await import('node:fs')).readFileSync('arkiv/wallets.md','utf8').match(/0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/g))]
const relayer='0x357A30b18BF4020F243186d76dBdD44b830119e2'.toLowerCase()
let bad=0
for (const w of wallets) {
  if (w.toLowerCase()===relayer) continue
  const q='\$creator = addr(' + w.toLowerCase() + ')'
  const headers={'content-type':'application/json',...(process.env.ARKIV_ACCESS_KEY?{'x-api-key':process.env.ARKIV_ACCESS_KEY}:{})}
  const r=await fetch(rpc,{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',id:1,method:'arkiv_query',params:[q,{limit:'0x1'}]})}).then(r=>r.json()).catch(e=>({error:String(e)}))
  const n=r?.result?.data?.length ?? 0
  if (r.error==='ANON_COST_LIMITED') { console.log('         anonymous query budget used up: rerun later or set ARKIV_ACCESS_KEY'); process.exit(2) }
  const note = n ? 'has entities' : (r.error ? 'query error: '+JSON.stringify(r.error).slice(0,80) : 'NO live entities (may have expired: check creation txs in docs/seed-manifest.json)')
  console.log('        ', w, note)
  if (!n) bad++
}
process.exit(bad?1:0)" && ok "every entity-creating wallet in wallets.md has a live entity" || bad "some wallets have no live entity (see above)"

echo "Deployment"
url=$(grep -E '^\| Live app \|' README.md | grep -oE 'https://[^ )*]+' | head -1)
if [ -n "${url:-}" ]; then
  code=$(curl -s -o /dev/null -w '%{http_code}' -L "$url")
  [ "$code" = "200" ] && ok "live URL $url returns 200 without auth" || bad "live URL $url returned $code"
else bad "no live URL found in README"; fi

echo "Links in docs/SUBMISSION_ANSWERS.md"
for u in $(grep -oE 'https://[^ )`>]+' docs/SUBMISSION_ANSWERS.md | sed 's/[.,]$//' | grep -v FILL | sort -u); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -L "$u")
  [ "$code" = "200" ] && ok "$u" || bad "$u -> $code"
done
if grep -q '\[FILL' docs/SUBMISSION_ANSWERS.md; then bad "docs/SUBMISSION_ANSWERS.md still has [FILL] markers"; else ok "no [FILL] markers left"; fi

echo
[ $fail -eq 0 ] && echo "ALL CHECKS PASSED" || echo "SOME CHECKS FAILED"
exit $fail
