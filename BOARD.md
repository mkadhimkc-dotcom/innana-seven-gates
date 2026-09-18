# Inanna: Seven Gates board

Exported 2026-09-17. Routines pick only from Ready. Each card line lists model, autopilot or needs-you, phase, dependencies, and estimate. Acceptance criteria follow each card.

## Ready (limit 8)

Empty

## Building (limit 2)

Empty

## Validating (limit 3)

Empty

## Human QA (limit 3)

### F-01 — Architecture decision and CLAUDE.md rules

`Claude Code (Anthropic)` · needs-you · Phase 1 (Playable slice) · deps: none · est. 1 session

Branch `claude/F-01`, merged to `develop`.

Acceptance criteria:

- [x] ADR records the tech stack: TypeScript, Phaser 3, installable PWA — `docs/adr/ADR-001-architecture.md`
- [x] ADR records the repo structure: source, tests, build output, levels
- [x] ADR records the build commands: `npm test`, `npm run validate`, `npm run build`, `npm run e2e`
- [x] ADR records CI/CD: GitHub Actions, tests on every push to `develop` — `.github/workflows/ci.yml`
- [x] `docs/CLAUDE.md` carries the deadlock rules (SPEC 8–19)
- [x] `docs/CLAUDE.md` carries the Definition of Done for levels (SPEC 20)
- [x] `docs/CLAUDE.md` carries the board workflow (SPEC 53)
- [x] Initial `package.json` and `src/` structure exist for routines to build on
- [x] `npm test` passes (38 tests), `npm run validate` proves `gate-01-01` deadlock-free, `npm run bots` finds no softlocks, `npm run build` is 1.2 MB uncompressed, `npm run e2e` passes on desktop and phone viewports

Waiting on: human review of the architecture decision before routines start building on it. This card ships no level, so the SPEC 48 playtests do not apply; SPEC 20 items 1–5 are level-only criteria.

## Backlog

Empty

## Certified

Empty
