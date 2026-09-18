# ADR-001: Architecture for Inanna: Seven Gates

- **Status:** Accepted
- **Date:** 2026-09-18
- **Card:** F-01 (Architecture decision and CLAUDE.md rules)
- **Deciders:** Mohammed Kadhim (design), Claude Code (engineering)
- **Source of truth:** `docs/SPEC.md` §2 (platform), §18–19 (validator), §50 (PR bar), §51 (build and deployment)

## Context

Inanna: Seven Gates is a 2D Mesopotamian puzzle-platformer of ~37 levels across
seven gates, phone-first with TV mirroring and Bluetooth controller support
(SPEC §1–§6). Two properties drive every technical choice:

1. **The deadlock-free guarantee is the product** (SPEC §8, §45). A level ships
   only if a validator proves that from *every* reachable state there is a path
   to the exit. That proof has to run headlessly, in CI, in under a minute per
   level (SPEC §19).
2. **Routines build most of the repo.** Automated Claude routines pick cards off
   the board and open PRs (SPEC §50, §53). The layout and the commands have to
   be boring, uniform, and impossible to get wrong from a cold start.

Everything below follows from those two facts.

## Decision 1: Tech stack

**TypeScript + Phaser 3, shipped as an installable progressive web app.**

| Choice | Why |
| --- | --- |
| **TypeScript 5 (strict)** | The puzzle state model (tiles, inventory, blocks, doors) is the thing the validator reasons about. Types are the cheapest way to keep the runtime model and the validator model from drifting apart. `strict: true`, no implicit `any`. |
| **Phaser 3** | Mature 2D web engine with scene management, tilemaps, input, and audio out of the box. Runs anywhere a browser runs, which is the whole delivery story (SPEC §2). No native toolchain, no store gatekeeping for Phases 1–4. |
| **PWA (installable)** | SPEC §2 requires phone install without an app store, offline play, and TV via AirPlay/Chromecast mirroring. A service worker with precached assets gives all three. Native tvOS/Android TV stays optional post-launch. |
| **Vite 7** | Dev server with HMR, and a production build that tree-shakes into the 5 MB uncompressed budget (SPEC §31). `vite-plugin-pwa` generates the service worker and manifest from config rather than hand-written boilerplate. |
| **Vitest** | Same transform pipeline as the build, so unit tests need no second toolchain. |
| **Playwright** | Drives a real Chromium for the gameplay smoke test. Chromium is already available in CI images we use. |

### The rule that makes this work: engine-free core

`src/core/` contains **no Phaser import and no DOM access**. It holds the tile
model, the move rules, the inventory rules, and the solver. `src/scenes/` is the
only place that talks to Phaser, and it calls into `core/` for every rule
decision.

This is not stylistic. The validator (SPEC §18) has to explore tens of thousands
of states per level in a Node process with no canvas. If a movement rule lives
inside a Phaser scene, the validator cannot see it, and the deadlock-free
guarantee quietly becomes a claim instead of a proof. **One rule, one
implementation, exercised by both the game and the validator.**

### Rejected alternatives

- **Unity / Godot** — native export quality is better, but SPEC §2 asks for a
  browser-installable build with no store dependency, and neither engine's web
  export fits the 5 MB budget comfortably.
- **Hand-rolled canvas engine** — tempting given the flat art direction (SPEC
  §46), but scene lifecycle, input abstraction, and audio would become our
  maintenance burden for no gameplay gain.
- **React + a game loop** — React's reconciliation model buys nothing for a
  fixed-camera tile game and costs bundle size.

## Decision 2: Repository structure

```
.
├── src/                    # Game source (TypeScript)
│   ├── core/               # Engine-free rules + solver. No Phaser, no DOM.
│   │   ├── types.ts        #   Tile, Item, LevelDefinition, GameState
│   │   ├── level.ts        #   Parse and sanity-check level JSON
│   │   ├── state.ts        #   applyMove: the single source of movement truth
│   │   ├── inventory.ts    #   3-item cap, drop-oldest (SPEC §12)
│   │   ├── blocks.ts       #   Push rules (SPEC §13)
│   │   └── validator/
│   │       ├── graph.ts    #   Reachable state graph (SPEC §18)
│   │       ├── reachability.ts  # Proof: every reachable state can reach exit
│   │       └── deadlock.ts #   Block-specific deadlock detector (SPEC §19)
│   ├── scenes/             # Phaser scenes. The only Phaser-aware layer.
│   ├── input/              # Touch, gamepad, keyboard maps (SPEC §27–§29)
│   ├── ui/                 # HUD, menus (SPEC §34)
│   ├── platform/           # Save/load, localStorage (SPEC §33)
│   └── main.ts             # Browser entry point
├── tests/                  # Unit + integration tests, mirrors src/
│   └── fixtures/           # Hand-built levels, including deliberately broken ones
├── levels/                 # Level data, one folder per gate
│   └── gate-01/
│       ├── *.json          #   Level definition (the data the validator reads)
│       └── *.md            #   Critical-path doc, 52 answers (SPEC §52)
├── tools/                  # Node CLIs: validator, bots
├── e2e/                    # Playwright gameplay smoke tests
├── public/                 # PWA manifest, icons, static assets
├── dist/                   # Build output. Generated, git-ignored.
├── docs/                   # SPEC.md, adr/
└── CLAUDE.md               # Build rules every Claude session reads first
```

Rules that follow from this layout:

- **Levels are data, not code.** A level is a JSON file plus a Markdown
  critical-path doc in the same folder, named the same. The validator consumes
  the JSON; humans and QA read the Markdown. Adding a level never requires
  touching `src/`.
- **`tests/` mirrors `src/`.** `tests/core/blocks.test.ts` tests
  `src/core/blocks.ts`. A routine that adds a rule knows exactly where its test
  goes without asking.
- **`dist/` is disposable.** Nothing reads from it except the deploy step. It is
  git-ignored and rebuilt from scratch in CI.

## Decision 3: Build commands

Four commands are the contract. They are what CI runs, what the PR bar (SPEC
§50) checks, and what any routine can assume exists.

| Command | Does | Gate it enforces |
| --- | --- | --- |
| `npm test` | Vitest over `tests/` | Rules, solver, and regressions |
| `npm run validate` | `tools/validate.ts` over every level in `levels/` | Deadlock-free guarantee (SPEC §18–§19) |
| `npm run build` | `vite build` → `dist/` | Ships, and stays inside the size budget |
| `npm run e2e` | Playwright against the built app | The game actually boots and plays |

Supporting commands: `npm run dev` (Vite dev server), `npm run typecheck`
(`tsc --noEmit`), `npm run bots` (adversarial bot playtests, SPEC §50), and
`npm run ci` which chains typecheck → test → validate → build.

`npm run validate` exits non-zero on the first level with a dead state and
prints the offending state plus a seed to reproduce it (SPEC §18). It is not
advisory. A red validator blocks the merge.

## Decision 4: CI/CD

**GitHub Actions, one workflow, running on every push to `develop`.**

`.github/workflows/ci.yml`:

- **Triggers:** every push to `develop`, every push to a `claude/**` routine
  branch, and every pull request targeting `develop`. Routines get the same
  feedback on their own branch that they would get after merge, so a red build
  is caught before a human is asked to review it.
- **Job `test`:** Ubuntu, Node 22 via `actions/setup-node` with npm caching,
  `npm ci`, then typecheck → `npm test` → `npm run validate` → `npm run build`.
  Ordered cheapest-first so a type error fails in seconds rather than minutes.
- **Job `e2e`:** depends on `test`, installs the Playwright browser, runs
  `npm run e2e` against the production build, and uploads the report on failure.

Deployment stays as SPEC §51 describes it: `develop` merges trigger a Cloudflare
Pages build, `main` carries releases only, rollback is a revert and a push.
Cloudflare builds from the same `npm run build`, so the artifact CI verified is
the artifact that ships.

## Consequences

**Good**

- The deadlock-free guarantee is mechanically checked on every push, not
  asserted in a doc.
- The validator and the game cannot disagree about a rule, because there is only
  one implementation of each rule.
- A routine starting cold needs four commands and one folder convention.
- No native toolchain means no signing, no store review, and no per-platform
  build matrix for Phases 1–4.

**Costs we accept**

- The engine-free-core rule is a discipline, not something the compiler enforces
  on its own. A lint rule banning Phaser imports under `src/core/` should follow
  in a later card.
- Full state-graph exploration is exponential in block count. Levels in Gates
  V–VII may need state-space caps or symmetry reduction; the 1-minute budget in
  SPEC §19 is the tripwire that tells us when.
- PWA install and controller support vary across iOS and Android browsers, so
  device testing cannot be skipped.

## Follow-up cards

- Lint rule enforcing "no Phaser or DOM imports under `src/core/`".
- Bundle-size budget check wired into CI (SPEC §31, 5 MB uncompressed).
- Cloudflare Pages project wiring and the `main` release workflow (SPEC §51).
- Bot playtest harness behind `npm run bots` (SPEC §50, §48).
