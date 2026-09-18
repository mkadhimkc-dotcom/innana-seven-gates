# Inanna: Seven Gates

A 2D Mesopotamian puzzle-platformer. Phone-first, installable as a PWA, with TV
mirroring and Bluetooth controller support.

Its promise is the **deadlock-free guarantee**: every puzzle is always solvable.
No undo button, no soft-lock traps. A validator proves it before you play.

## Documents

| File | What it is |
| --- | --- |
| [`docs/SPEC.md`](docs/SPEC.md) | The game design document. The source of truth. |
| [`docs/CLAUDE.md`](docs/CLAUDE.md) | Build rules every Claude session reads first. |
| [`docs/adr/ADR-001-architecture.md`](docs/adr/ADR-001-architecture.md) | Stack, structure, commands, CI. |
| [`docs/deploy-cloudflare.md`](docs/deploy-cloudflare.md) | One-time Cloudflare Pages setup for automatic deploys (SPEC 51). |
| [`BOARD.md`](BOARD.md) | The Scrumban board routines pull cards from. |

## Getting started

```bash
npm install
npm run dev        # Vite dev server
```

## The four commands

```bash
npm test           # Unit tests (Vitest)
npm run validate   # Prove every level deadlock-free (SPEC 18-19)
npm run build      # Production build into dist/
npm run e2e        # Playwright gameplay smoke test
```

Also available: `npm run typecheck`, `npm run bots` (adversarial playtests), and
`npm run ci`, which chains typecheck → test → validate → build.

## Layout

```
src/core/      Engine-free rules and the solver. No Phaser, no DOM.
src/scenes/    Phaser scenes. The only Phaser-aware layer.
levels/        Level JSON plus its critical-path doc (SPEC 52).
tests/         Unit and integration tests, mirroring src/.
tools/         Validator and bot CLIs.
e2e/           Playwright smoke tests.
dist/          Build output. Generated, git-ignored.
```

The rule that holds it together: `src/core/` never imports Phaser or touches the
DOM, so the game and the validator run the same movement rules. See
[ADR-001](docs/adr/ADR-001-architecture.md).
