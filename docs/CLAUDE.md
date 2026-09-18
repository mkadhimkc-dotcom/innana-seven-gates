# Inanna: Seven Gates — Claude build rules

Every session reads this file first. It encodes the deadlock rules, the
Definition of Done, and the board workflow.

`docs/SPEC.md` is the source of truth. Where this file and SPEC disagree, SPEC
wins and this file is the bug. Section numbers below refer to SPEC.

---

## 0. Architecture decision (F-01)

Decided in [`docs/adr/ADR-001-architecture.md`](adr/ADR-001-architecture.md).
The short version:

- **Stack:** TypeScript (strict) + Phaser 3, built by Vite into an installable
  PWA. Vitest for unit tests, Playwright for end-to-end, Cloudflare Pages for
  hosting (SPEC 2, 51).
- **The one structural rule:** `src/core/` is engine-free. No Phaser import, no
  DOM access. It holds the tile model, the movement rules, and the solver.
  `src/scenes/` is the only Phaser-aware layer, and it asks `src/core/` whether
  a move is legal rather than deciding for itself. The deadlock-free guarantee
  is only a proof if the validator and the game run the same code.
- **Layout:** `src/` source, `tests/` mirroring `src/`, `levels/` for level data
  plus critical-path docs, `tools/` for the CLIs, `e2e/` for smoke tests,
  `dist/` for build output (git-ignored, disposable), `docs/` for SPEC, these
  rules, and ADRs.
- **Commands:** `npm test`, `npm run validate`, `npm run build`, `npm run e2e`.
  Plus `npm run dev`, `npm run typecheck`, `npm run bots`, and `npm run ci`.
- **CI:** one GitHub Actions workflow, on every push to `develop`, on every push
  to a `claude/**` routine branch, and on every PR into `develop`.

### Working agreements

- Never add a rule to a scene. If the game needs to know whether something is
  allowed, the answer lives in `src/core/` and both the game and the validator
  read it there.
- Never add a movement, inventory, or block rule without a unit test in
  `tests/core/` and a validator run over the affected levels.
- Levels are data. Adding a level means adding `levels/<gate>/<id>.json`, its
  `<id>.md` critical-path doc, and a line in `src/level-registry.ts`. It never
  means editing `src/core/`.
- Every PR must pass `npm test`, `npm run validate`, `npm run bots`, and
  `npm run e2e`, and must update `BOARD.md` to reflect the card's new column
  (SPEC 50).
- Develop on `develop` (or a `claude/<card>` branch off it). `main` carries
  releases only. Rollback is a revert and a push (SPEC 51).

---

## 1. Deadlock rules (SPEC 8–19)

These are the rules the whole project exists to keep. Read them before touching
level data, movement, or the validator.

### 1.1 Deadlock definition (SPEC 8)

A **deadlock** is any state from which no sequence of actions reaches the exit.
Example: a block pushed into a corner where it can no longer be retrieved, when
that block is needed to proceed.

**Deadlocks are forbidden by design.** Every level passes a validator that
proves: from *every reachable state*, a path to the exit exists. "The intended
route works" is not the bar. "No reachable state is dead" is the bar.

### 1.2 Level structure (SPEC 9)

Each level is a single room containing:

- **Tiles:** floor, wall, water, lava, spike, goal.
- **Entities:** player, NPC statues, pushable blocks, items.
- **Three routes:** safe (no timer), standard (60s), expert (30s).
- **A critical path:** the sequence of actions required to reach the goal.
- **Treasure:** optional, unlocks New Game+ cosmetics, and is **never required**
  to finish a level.

### 1.3 Checkpoints and safe saves (SPEC 10)

A checkpoint saves position and inventory **only when both hold**:

1. The exit is still reachable from that state — the validator confirms it.
2. The player is not trapped.

If the player does become trapped, they return to the last safe checkpoint
automatically. Implemented in `src/platform/checkpoint.ts`; an inconclusive
search counts as unsafe, costing the player a checkpoint rather than risking a
soft-lock.

### 1.4 Room transitions (SPEC 11)

Moving between rooms (exit → next level entrance) preserves inventory. An item
picked up in a previous session stays gone from the room it came from.

### 1.5 Inventory limits (SPEC 12)

The player carries up to **3 items**. Picking up a 4th drops the **oldest** at
the player's feet. Implemented in `src/core/inventory.ts`.

### 1.6 Block mechanics (SPEC 13)

- Blocks are 1×1 tiles.
- The player pushes them by moving into them. **Blocks cannot be pulled.**
- Blocks stop at walls.
- Blocks pushed into water or lava sink and disappear. **This is one-way** and
  is the most common source of deadlocks.
- Blocks cannot be pushed into spikes; they stop before the spike.

Implemented in `src/core/blocks.ts`.

### 1.7 Keys and doors (SPEC 14)

Keys open doors of matching colour. Picking up a key does not consume it — the
player carries it. **Doors stay open after unlocking.** Keys can be dropped and
picked up again.

### 1.8 Torches and lighting (SPEC 15)

A tile holding a torch is lit, and tiles within 3 cells of a lit tile are lit.
Dark tiles halve movement speed. Torches can be dropped and picked up.

### 1.9 Time pressure (SPEC 16)

Safe route: no timer. Standard: 60 seconds. Expert: 30 seconds. The timer is
shown on screen. **Running out restarts from the last checkpoint** — which,
by 1.3, is always a state the exit is reachable from.

### 1.10 Visual theme (SPEC 17)

Mesopotamian: clay brick walls, sandy floors, cuneiform patterns. Palette of
terracotta, gold, deep blue, lapis lazuli. Hazards red, water cyan, lava orange.
The player is a semi-transparent silhouette. Defined in `src/ui/palette.ts`.

### 1.11 Validator: solvability proof (SPEC 18)

For each level the validator builds a state graph:

- **Nodes:** reachable (player position, inventory, block positions, ground
  items, opened doors).
- **Edges:** legal moves from each node.
- **Proof:** from every reachable node there exists a path to the exit node.
- **On failure:** the report names the dead state and a seed to reproduce it.

Implemented in `src/core/validator/graph.ts` and `reachability.ts`, run by
`npm run validate`.

### 1.12 Validator: block deadlock detection (SPEC 19)

For levels with blocks (Gates III+), the block deadlock detector also runs:

- Detect **irreversible block pushes** — a block cornered where it cannot be
  retrieved, or sunk in water or lava.
- Confirm the puzzle is **still solvable even if that block is lost**.
- If not, flag it as a deadlock and **fail validation**.
- Must complete in **under 1 minute per level**.

Implemented in `src/core/validator/deadlock.ts`.

### 1.13 How to obey these rules in practice

- **Run `npm run validate` before every commit that touches a level or a rule.**
  Not before the PR — before the commit.
- A validator failure is never "fix it later" and never a reason to relax the
  check. Change the level, or change the rule and re-prove every level.
- Never weaken a budget to make a level pass. A validator that truncates its
  search reports failure, not success, because an unfinished search proves
  nothing. If a level cannot be proven inside the SPEC 19 budget, the level is
  too complex — simplify it, or open a card for a better search strategy.
- When you add a mechanic, ask first: **can it be made irreversible?** If yes,
  it needs a deadlock check before it ships. One-way transitions are where
  deadlocks come from.
- Treasure must never be on the critical path (SPEC 9).

---

## 2. Definition of Done for levels (SPEC 20)

A level is not done until **all six** hold. Not five. There is no partial pass.

1. **Critical-path doc answers all 52 questions** in SPEC 52.
   Lives beside the level: `levels/<gate>/<id>.md`.
2. **Validator finds no dead states; bots find no softlocks.**
   `npm run validate` and `npm run bots` both clean.
3. **Safe, standard, and expert routes present**; optional treasure never
   required.
4. **Difficulty within the gate's target range** (SPEC 25), inspector confirms.
5. **First-time, experienced, and adversarial playtests pass** (SPEC 48).
6. **Level is Certified in the build board** before it can ship.

### The playtest rubric (SPEC 48)

| Playtest | Passes when |
| --- | --- |
| **First-time** (new player, no hints) | Reaches the goal on the safe route within the time limit, is not confused by the controls, and finishes in 1–10 minutes |
| **Experienced** (knows the game) | Beats the standard route within 60 seconds, finds the critical path intuitively, hits no frustration or exploits |
| **Adversarial** (bots hunting softlocks) | Bots cannot trap the player, all recoverable traps are detected and blocked, validator confirms no dead states |

### Certified (SPEC 49)

A level is Certified when all three playtests pass, the validator reports zero
dead states, the block deadlock detector passes where applicable, the
critical-path doc is complete and accurate, and difficulty is within the gate's
target range.

**Routines cannot certify a level.** Items 5 and 6 need a human. A routine takes
a level as far as Human QA and stops there.

---

## 3. Board workflow (SPEC 53)

`BOARD.md` is the board. Six columns, with work-in-progress limits:

| Column | Meaning | Limit |
| --- | --- | --- |
| **Backlog** | Not started | — |
| **Ready** | Waiting to start; refilled when Backlog < 3 | 8 |
| **Building** | Active work | 2 |
| **Validating** | Blocked, waiting for fixes | 3 |
| **Human QA** | Waiting for playtest | 3 |
| **Certified** | Done, ready to merge to `main` | — |

### Rules for routines

- **Pick only from Ready.** Never start a card from Backlog, and never invent a
  card that is not on the board.
- **Respect the limits.** If Building is at 2, do not start a third card. A full
  column means finish something, not start something.
- **Move the card as you go**, and put the move in the same PR as the work
  (SPEC 50). The board and the branch never disagree.
- **Humans merge PRs and run playtests.** Routines do not merge and do not mark
  a playtest passed.
- **Finished work is routed by the Certification rules below**, not by the
  card's estimate.
- **Every level waits for playtests.** There is no fast path.
- **When Human QA is full, skip level cards** and pick up non-level cards
  instead — systems, tools, art. This keeps testing pace with building rather
  than piling up unplayed levels.
- **A blocked card goes to Validating**, with what is blocking it written on the
  card. It does not sit silently in Building.

### Certification

Where a finished card goes is decided by **what the card is**, not by what its
estimate says. Check these in order and take the first match:

1. **Level card → Human QA.** Only a human certifies a level, and only after
   the three playtests pass (SPEC 48, 49). A routine takes a level as far as
   Human QA and stops.

2. **Card a person must physically do → Human QA.** Anything needing hardware,
   a real device, or an account a routine cannot hold: the TV and controller
   test, connecting a third-party account such as Cloudflare, store signup.
   The routine does every part it can, then hands over.

3. **Card that raises a decision or an open question for the owner →
   Validating.** Append `| blocked: decision needed` to the card line, followed
   by a one-line summary of the actual question. For example:

   ```
   - [ ] S-02 Player movement and feel | ... | blocked: decision needed
     - Coyote time: 6 frames matches the reference games, 10 feels better on
       touch. Which?
   ```

   A question the owner has not answered is never resolved by picking one and
   certifying. State the question and stop.

4. **Every other card → Certified**, once both hold: all its acceptance
   criteria are met, and the CI run for its merge commit on `develop` has
   **completed green**.

   Read the run. A run still in flight is not a pass, and neither is a green
   run on a different commit. If CI is red or unfinished, leave the card in
   **Ready** with a one-line note naming the failing job — for example:
   `CI red on <sha>: Gameplay smoke test failed`.

   This is the rule F-02 was certified against and failed: its `Gameplay smoke
   test` job had failed on every run since CI was added, and its own first
   criterion says the commands pass locally *and in CI*. "It passes locally" is
   not that criterion.

### Card format

Each card line carries: model, autopilot or needs-you, phase, dependencies, and
estimate. Acceptance criteria follow the card. A card without acceptance
criteria is not Ready — it is Backlog.
