# Arkiv surfaces used

For Devfolio question 10. Only ticked if we actually used it; each line says where.

| Surface | Used? | Where / how |
|---|---|---|
| TypeScript SDK (`@arkiv-network/sdk` 0.8.1) | **Yes** | `packages/tolmol-sdk`, `apps/web`, `scripts/*` |
| Direct JSON-RPC | **Yes** | `arkiv_query` and `eth_getBalance` with curl (README reproduction, friction F5/F13 probes); `apps/web/public/mirror.html` reads with plain `fetch` JSON-RPC, no SDK |
| WebSocket events | **Yes** | `watchEntityEvents` over `webSocket()` in `packages/tolmol-sdk/src/live.ts`, dashboard; tested in `scripts/test-events.mjs` |
| Docs | **Yes** | docs.arkiv.network: fundamentals, querying, mutating, live events, best practices, access keys, Tiramisu |
| Hub | **Yes** | Faucet page (builder funded the reporter wallet) |
| Faucet | **Yes** | Funded the reporter wallet on 2026-10-13; cooldown observation in friction F3 |
| Access keys | No | Not used. The anonymous budget limit (friction F13) is the reason we would use one next |
| Block Explorer | **Yes** | Entity/tx/address links throughout the app and docs; HTTP checks in friction |
| Data Explorer | No | |
| Arkiv MCP | No | |
| Arkiv skills | Partly | Read `Arkiv-Network/skills` (commit `ce5ee78`) as reference while designing; not installed into the agent |
| Arkiv Plugin | No | |
| Other | No | |
