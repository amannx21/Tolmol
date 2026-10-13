# Contributing

Thanks for helping. Tolmol is MIT-licensed and the data contract is public, so you can also build your own
tool on the same Arkiv data without asking: see `arkiv/schema.md`.

## Setup

```bash
git clone https://github.com/amannx21/Tolmol && cd Tolmol
npm ci
git config core.hooksPath .githooks   # enables the pre-commit secret check
npm test                              # unit tests (no network)
npm run dev -w tolmol-web             # web app on http://localhost:5173
```

The live end-to-end test needs three funded Tiramisu test wallets in `.env` (see `.env.example`):

```bash
npm run test:e2e
```

## Rules

- TypeScript strict. Run `npm run lint`, `npm run typecheck` and `npm test` before a pull request.
- Never commit a key, `.env` or `.seed-wallets.json`. Never put personal data, free text or real shop IDs into an entity.
- Attribute names are lowercase snake_case. Quantities are integer grams. Percentages are integer basis points.
- Changing the entity shape means bumping `schema_version` and updating `arkiv/schema.md` in the same pull request.
- Found something odd about Arkiv itself? Add it to `arkiv/friction.md` with expected vs actual, versions and repro steps.
