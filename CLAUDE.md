# Inanna: Seven Gates — Claude build rules

Every session reads this file first. It encodes the deadlock rules, the
Definition of Done, and the board workflow.

**If you are running a lane, follow [`docs/LANE.md`](docs/LANE.md).** That is
the operating procedure — how to start from a known commit, keep `develop`
green, keep the queue full, pick a card, prove it, merge it, and certify it.
This file is the rules a lane works within; LANE.md is the order it does things
in.

`docs/SPEC.md` is the source of truth. Where this file and SPEC disagree, SPEC
wins and this file is the bug — except where `docs/DECISIONS.md` records the
owner deciding otherwise. Section numbers below refer to SPEC.

---

## 0. Architecture decision (F-01)

Decided in [`docs/adr/ADR-001-architecture.md`](docs/adr/ADR-001-architecture.md).
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
  `dist/` for build output (git-ignored, disposable), `docs/` for SPEC and ADRs.
  These rules live in `CLAUDE.md` at the repo root, so every session loads them
  without being pointed at a path.
- **Commands:** `npm test`, `npm run validate`, `npm run build`, `npm run e2e`.
  Plus `npm run dev`, `npm run typecheck`, `npm run bots`, and `npm run ci`.
- **CI:** one GitHub Actions workflow, on every push to `develop`, on every push
  to a `claude/**` routine branch, and on every PR into `develop`.

### Working agreements

- Never add a rule to a scene. If the game needs to know whether something is
  allowed, the answer lives in `src/core/` and both the game and the validator
  read it there.
- Never add a movement, collection, block or guardian rule without a unit test
  in `tests/core/` and a validator run over the affected levels.
- Levels are data. Adding a level means adding `levels/<gate>/<id>.json`, its
  `<id>.md` critical-path doc, and a line in `src/level-registry.ts`. It never
  means editing `src/core/`.
- **Build a new level from `docs/SPEC.md` and the v2 schema — never by copying
  an existing level.** Everything under `levels/` today is v1 and superseded
  (`levels/SUPERSEDED.md`); it is a top-down room with a key, a door and a
  pushable block, none of which exist in v2. Copying it would rebuild the game
  that was just voided.
- If a level needs a tile, entity or mechanic `src/core/` does not model, the
  validator will refuse it by name (`src/core/validator/coverage.ts`). Model the
  mechanic first. Never work around the guard — it is what keeps SPEC 18's proof
  honest.
- Every PR must pass `npm test`, `npm run validate`, `npm run bots`, and
  `npm run e2e`, and must update `BOARD.md` to reflect the card's new column
  (SPEC 50).
- Develop on `develop` (or a `claude/<card>` branch off it). `main` carries
  releases only. Rollback is a revert and a push (SPEC 51).

---

## 1. The rules of the game (SPEC 8–19)

These are the rules the whole project exists to keep. Read them before touching
level data, movement, or the validator.

**This is a side-view platformer** in the idiom of *King's Valley* (MSX, 1985).
If you find yourself writing block pushing, a carried inventory, keys, doors or
torches, you are building v1, which is void — see `docs/DECISIONS.md` D-005.

### 1.1 Deadlock definition (SPEC 8)

A **deadlock** is any state from which no sequence of actions collects the
remaining jewels and reaches the gate. Example: you broke the block you needed
to stand on to reach the last jewel, and nothing else reaches it.

**Deadlocks are forbidden by design.** Every level passes a validator that
proves: from *every reachable non-death state*, a path exists that collects
every remaining jewel and reaches the gate. "The intended route works" is not
the bar. "No reachable state is dead" is the bar.

Death is **not** a deadlock. Death restarts the level (1.4), and the start state
is completable by construction.

### 1.2 Level structure (SPEC 9)

One screen, no scrolling:

- **Tiles:** empty, solid brick, breakable block, ladder, gate, spikes.
- **Entities:** player, jewels, guardians, axe pickups.
- **Every jewel is required.** There is no optional treasure.

**Level budget**, enforced by the validator: 8 jewels, 10 breakable blocks,
4 guardians, 4 axe uses, 32×24 grid. Over budget is a validation failure, for
the same reason a truncated search is — the proof has to finish.

### 1.3 The goal (SPEC 7)

Collect every jewel and the gate opens. Enter the gate to finish the level. The
puzzle is the *order and route*, not dexterity.

### 1.4 Death and restart (SPEC 10, D-006)

Guardian or spike contact kills. **Death restarts the level from its start
state** — jewels, broken blocks, axe uses and killed guardians all revert, and
the guardian cycle restarts at phase zero.

**There are no in-level checkpoints, and assists may never add one.** A
checkpoint that restored progress but reset the guardian phase would create a
state the validator never explored, which can be dead while the level certifies
clean. Nothing carries between levels either (SPEC 11), which is what lets each
level be proven in isolation.

### 1.5 Movement (SPEC 13)

Run left and right at constant speed, no acceleration. **One jump arc** — same
height, distance and duration every time. No double jump, no wall jump, no
variable height from holding the button. Gravity applies when not grounded or
climbing. **Falls are safe at any height**; only guardians and spikes kill.

The fixed arc is the point: it makes every jump either possible or impossible,
never a matter of execution skill, and it is what lets 1.11 prove clearance
geometrically.

### 1.6 Ladders (SPEC 14)

Climb while overlapping a ladder tile; step off either side onto solid ground.
Jumping from a ladder uses the same fixed arc.

### 1.7 Breakable blocks and the axe (SPEC 15)

Some blocks are breakable. Breaking one is **permanent for the attempt**.
Breaking needs an axe found in the level with **limited uses**; one use breaks
one block **or** kills one guardian. Uses are never refunded.

**This is the main source of dead states.** Spending the last use on the wrong
block, or breaking the platform you needed, is exactly what 1.10 exists to prove
away before a level ships.

### 1.8 Guardians (SPEC 16)

Guardians patrol **fixed, cyclic routes**. Contact kills.

**Determinism is mandatory.** A guardian's position is a pure function of
`(guardian, phase)`. No randomness, no player-seeking, no reaction to player
position, ever. A guardian that reacts to the player makes the state space
unprovable — that is not a design trade-off, it is a spec violation, and it is
why card S-08 was voided rather than rewritten.

**Every guardian cycle must divide the level's declared period, ≤ 256 frames.**
Otherwise the combined phase is the LCM of the cycles and the graph explodes.

One axe use kills a guardian; it stays dead for that attempt.

### 1.9 Visual rules (SPEC 12, 17, 30, 46)

16×16 tiles, **integer scaling only**, letterboxed into 16:9. Fixed camera, one
screen, no scrolling and no camera movement. **Two-frame animation at 8fps,
never three.** Mesopotamian palette. Guardians distinct in **silhouette**, not
only colour (SPEC 32).

### 1.10 Validator: solvability proof (SPEC 18)

The state is exactly **nine** components (D-007):

1. player cell · 2. facing · 3. vertical state (`grounded`, `climbing`,
`jumping(frame, dx)`, `falling(frame, dx)`) · 4. jewels collected ·
5. blocks broken · 6. **guardians killed** · 7. **axe pickups collected** ·
8. axe uses remaining · 9. guardian phase

**Guardian position is derived, never stored.** Storing it would let two
identical states differ and would admit a guardian driven by something other
than the clock — S-08's failure one layer down.

The four easiest to omit and fatal to omit are 6, 2, the direction inside 3, and
7. `docs/DECISIONS.md` D-007 says why for each.

The proof also covers: no jewel unreachable, no axe required but absent, no
breakable block destroyable into an unwinnable state.

### 1.11 Validator: clearance and timing (SPEC 19)

**Jump clearance.** Sweep the fixed arc tile by tile for every jump a required
route uses. An arc that clips solid geometry fails the level.

**Timing margin.** Every required guardian passage must pass with a margin above
the gate's floor (SPEC 25). **A safe route needing frame-perfect input is a
validator failure, not a matter of taste.**

Both must complete in **under 1 minute per level**.

### 1.12 How to obey these rules in practice

- **Run `npm run validate` before every commit that touches a level or a rule.**
  Not before the PR — before the commit.
- A validator failure is never "fix it later" and never a reason to relax the
  check. Change the level, or change the rule and re-prove every level.
- Never weaken a budget to make a level pass. A validator that truncates its
  search reports failure, not success, because an unfinished search proves
  nothing.
- When you add a mechanic, ask first: **is it irreversible, and is it
  deterministic?** Irreversible needs a dead-state proof. Non-deterministic
  cannot be proven at all and does not belong in this game.
- The validator must use a **packed integer state key**, not a string one. The
  naive state product exceeds 10^14 and only the reachable set saves you.

---

## 2. Definition of Done for levels (SPEC 20)

A level is not done until **all six** hold. Not five. There is no partial pass.

1. **Critical-path doc answers all 52 questions** in SPEC 52.
   Lives beside the level: `levels/<gate>/<id>.md`.
2. **Validator finds no dead states; bots find no softlocks.**
3. **Every jewel reachable, gate reachable, jump clearance and timing margin
   proven** (SPEC 19).
4. **Difficulty within the gate's target range** (SPEC 25), inspector confirms.
5. **First-time, experienced, and adversarial playtests pass** (SPEC 48).
6. **Level is Certified in the build board** before it can ship.

### The playtest rubric (SPEC 48)

| Playtest | Passes when |
| --- | --- |
| **First-time** (new player, no hints) | Completes the level, no confusion about controls; **in Gate I, without repeated deaths** |
| **Experienced** (knows the game) | Finds the jewel route intuitively, no frustration, no exploits, no passage that feels frame-perfect |
| **Adversarial** (bots hunting dead states) | Bots cannot reach a state the level cannot be finished from; validator confirms no dead states; no jump clips geometry |

### Certified (SPEC 49)

All three playtests pass, validator reports zero dead states, clearance and
timing margin pass, the critical-path doc is complete and accurate, and
difficulty is within the gate's target range.

**A lane certifies levels too**, under LANE step 10 — see the Certification
rule below. Item 5's three playtests no longer gate certification; the level is
appended to `docs/PLAYTEST-QUEUE.md` for the owner to play afterwards. This is
an owner decision that overrides SPEC 20 item 5 and SPEC 49; it is recorded as
D-004 in `docs/DECISIONS.md`, with what it costs and how to reverse it.

---

## 3. Board workflow (SPEC 53)

`BOARD.md` at the **repo root** is the board. SPEC 53 and SPEC 50 call it
`board/BOARD.md`; there is no `board/` directory and none is to be created —
read and write the root file. Six columns, with work-in-progress limits:

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
- **Follow [`docs/LANE.md`](docs/LANE.md).** It is the order of operations; the
  rules here are what it works within.
- **Finished work is routed by the Certification rule below**, not by the
  card's estimate.
- **Playtests follow certification, they do not gate it.** A certified level is
  appended to `docs/PLAYTEST-QUEUE.md` and the lane moves on.
- **When Human QA is full, skip level cards** and pick up non-level cards
  instead — systems, tools, art. This keeps testing pace with building rather
  than piling up unplayed levels.
- **A blocked card goes to Validating**, with what is blocking it written on the
  card. It does not sit silently in Building.

### Certification rule (LANE step 10)

When a card's acceptance criteria are met **and** the GitHub Actions run for its
merge commit on `develop` has finished green, move the card to **Certified**.

Read the run. A run still in flight is not a pass, and neither is a green run on
a different commit. If CI is red or still running, leave the card in **Ready**
with a one-line note naming the failing job — for example:
`CI red on <sha>: Gameplay smoke test failed`.

This includes **level cards**, provided all four hold:

- the validator reports no dead states,
- the bots find no softlock,
- the level is inside its gate's difficulty target (SPEC 25), and
- `docs/playtests/<card-id>.md` exists.

Append every certified level to `docs/PLAYTEST-QUEUE.md` as an unchecked line.
**That queue never blocks the pipeline** — it records what the owner may play,
it is not a gate a lane waits on.

Two things still stop a lane rather than being certified by it:

- **Something only a person can do** — creating an account, paying, a physical
  device, a credential. Append click-by-click steps to `HUMAN.md`, then pick a
  different card (LANE step 12).
- **Nothing else.** A SPEC ambiguity is resolved by the lane and written into
  `docs/DECISIONS.md` (LANE step 11), never parked for the owner's opinion.

### Card format

Each card line carries: model, autopilot or needs-you, phase, dependencies, and
estimate. Acceptance criteria follow the card. A card without acceptance
criteria is not Ready — it is Backlog.
