# LLMs used

For Devfolio question 13.

- **Claude (Anthropic), via Claude Code**, used as a coding agent throughout the build: reading the rules and
  Arkiv docs, running on-chain experiments, writing the SDK, web app, relayer, tests and documentation.
  The builder reviewed and directed the work.

Things an LLM produced that need human review before relying on them:

- The **Hindi strings** in `apps/web/src/i18n.ts` (drafted with the model, then checked and corrected by the builder, a native Hindi speaker, including the read-aloud voice).
- Every factual claim about the PDS was checked by opening the primary source; see `docs/SOURCES.md`.
