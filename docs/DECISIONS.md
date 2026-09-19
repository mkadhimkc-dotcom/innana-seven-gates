# Decisions

Ambiguities in `docs/SPEC.md`, resolved against the spec and written down so no
lane re-litigates them (LANE step 11). SPEC stays the source of truth; nothing
here overrides it. Each entry records the decision, the reasoning, and how to
reverse it.

---

## D-001 — Hazards are impassable for the player, not lethal

**Decided:** 2026-09-18 · **Raised by:** F-01 · **Implemented in:**
`src/core/state.ts` (`playerCanEnter`), `src/core/board.ts`

Water, lava and spikes cannot be entered by the player. A move into one is
refused by the rules, exactly like a move into a wall. There is no death, no
respawn, and no damage.

**Reasoning.** SPEC 9 lists water, lava and spikes as tiles and SPEC 13 says
what they do to *blocks* (sink, one-way) — but SPEC never defines what happens
when the *player* enters one. Two readings were available, and the spec decides
between them:

- SPEC 8 forbids deadlock and SPEC 45 sells a "deadlock-free guarantee". Lethal
  hazards create states whose only exit is death, which the validator would
  have to model as a distinct recovery edge.
- SPEC 10 lets the player return to a checkpoint only from a state the exit is
  reachable from, and SPEC 42 lists "soft-lock from trapping player" as a risk
  mitigated by checkpoints. Both assume the player is always *somewhere
  recoverable* — not dead.
- SPEC 3 says "Deadlock-free: every level is always solvable from the current
  state." A dead player has no current state.

Impassable hazards keep the state graph free of death states, so the
solvability proof in SPEC 18 quantifies over positions the player can actually
occupy. Hazards still do real work: they constrain routing and they swallow
blocks irreversibly (SPEC 13), which is where SPEC 19's deadlock detector earns
its keep.

**How to reverse.** Make `playerCanEnter` in `src/core/state.ts` admit `water`,
`lava` and `spike`, and add a death edge from each such state back to the last
safe checkpoint. The validator needs the matching change in
`src/core/validator/graph.ts` so a death edge counts as a path, or every hazard
tile becomes a reported dead state. Expect the state graph to grow and SPEC 19's
one-minute budget to tighten.

**Consequence for the sweep report.** SPEC 40 and the Q-01..Q-08 sweep cards
require **deaths broken down by cause**. Under this decision the player cannot
die, so that breakdown is empty by construction — a sweep must say "no death
model; see D-001" rather than silently omitting the section. If deaths by cause
turns out to be load-bearing for difficulty tuning (SPEC 25), that is the signal
to reverse this decision, not to fake the data.

---

## D-002 — One ground item per tile, and blocks may not be pushed onto items

**Decided:** 2026-09-18 · **Raised by:** F-01 · **Implemented in:**
`src/core/state.ts` (`applyDrop`), `src/core/blocks.ts` (`resolvePush`)

A tile holds at most one dropped item. Dropping onto an occupied tile is
refused, and a block may not be pushed onto a tile holding an item.

**Reasoning.** SPEC 12 says a fourth pickup drops the oldest item "at the
player's feet" and SPEC 14/15 say keys and torches can be dropped and picked up
again — but SPEC never says what happens when two items share a tile, or when a
block is pushed over one.

Allowing either creates exactly the failure SPEC 8 forbids. A block resting on a
key makes that key unreachable, and SPEC 13 makes block pushes irreversible in
the general case, so the key is gone for good. If that key opens the only door
to the exit, the level is dead — and dead in a way the level author cannot see,
because the item is still "in" the level. SPEC 45 promises no soft-lock traps.

The one-item rule also keeps the state encoding total: `ground` maps an item id
to a position, and a position identifies at most one item, so
`encodeState` in `src/core/state.ts` stays a faithful key and the validator's
node collapsing stays sound.

**How to reverse.** Change `ground` to map a position to an ordered stack of
item ids, drop the occupied-tile check in `applyDrop`, and drop the
`groundItemAt` check in `resolvePush`. Then SPEC 19's deadlock detector must
grow a case for "item buried under a block", because the reachability proof
alone will report the resulting dead state without naming the cause.

---

## D-003 — Input is read as intents, never as raw device events

**Decided:** 2026-09-18 · **Raised by:** F-01 · **Implemented in:**
`src/input/intents.ts`, `src/input/{keyboard,touch,gamepad}.ts`

Touch, controller and keyboard each translate into a small shared `Intent`
vocabulary. Gameplay reads intents. No scene reads a key code, a pointer, or a
gamepad button.

**Reasoning.** SPEC 27, 28 and 29 specify three different input devices for the
same actions, and SPEC 29 requires keyboard to be debug-only and absent from
release builds. Three devices driving the rules directly would mean three
implementations of "can the player do this", which contradicts the ADR-001 rule
that `src/core/` is the only thing that decides legality. Intents also make
SPEC 35's assists and P-01's per-device remapping a mapping change rather than a
gameplay change.

**How to reverse.** Have scenes subscribe to Phaser's input events directly and
delete `src/input/intents.ts`. Doing so gives up single-source rule evaluation,
so ADR-001's core/scene split would need revisiting first.

See `docs/adr/ADR-001-architecture.md` for the architectural statement of this
decision.

---

## D-004 — A lane certifies levels; playtests follow certification

**Decided:** 2026-09-18 · **Raised by:** the owner, building the autonomy layer
· **Implemented in:** `docs/LANE.md` step 10, `CLAUDE.md` §2 and §3

A lane moves a level card to Certified once the validator reports no dead
states, the bots find no softlock, the level is inside its gate's difficulty
target (SPEC 25), `docs/playtests/<card-id>.md` exists, and CI on the merge
commit is green. The level is then appended to `docs/PLAYTEST-QUEUE.md` for the
owner to play. The queue never blocks the pipeline.

**This overrides SPEC.** SPEC 20 item 5 requires first-time, experienced and
adversarial playtests to pass before a level is done, and SPEC 49 repeats it for
certification. Under this decision only the adversarial leg — the bots and the
validator, SPEC 48's third row — still gates. The two human legs move after the
gate instead of before it.

**Reasoning.** The board carries 37 level cards at 2 h of human playtesting
each: 75 hours, against a Human QA column with a limit of 3. Lanes produce
certifiable work faster than one person can play it, so under the SPEC reading
every lane eventually blocks on the same queue and the project stops. The owner
judged a certified-but-unplayed level a better failure mode than a stalled
pipeline, on the grounds that the machine-checkable half of SPEC 48 — no dead
states, no bot softlock — is the half that catches the failures SPEC 8 and
SPEC 45 actually promise against.

**What it costs.** "Certified" no longer means a human has played it. Nothing in
the repo distinguishes a level a person has enjoyed from one that merely passes
its proofs, so first-time confusion, unfair difficulty and un-fun-but-solvable
levels (SPEC 48's first two rows, SPEC 52 Q50 and Q51) can reach Certified and
stay there. The playtest queue is the only place that gap is visible, and
nothing forces it to be drained.

**How to reverse.** Delete the level-card clause from LANE step 10 and the
Certification rule in `CLAUDE.md`, restoring "a lane takes a level as far as
Human QA and stops". Levels already certified under this decision should be
moved back to Human QA, since none of them will have had the two human
playtests. `docs/PLAYTEST-QUEUE.md` lists exactly which ones those are.

---

## D-005 — v1's top-down model is void; the game is a side-view platformer

**Decided:** 2026-09-19 · **Raised by:** the owner · **Implemented in:**
`docs/SPEC.md` v2, `BOARD.md`

The game is a **side-view platformer** in the idiom of Konami's *King's Valley*
(MSX, 1985): one screen per level, run and jump and climb, collect every jewel
to open the gate, guardians on fixed patrols that kill on contact, breakable
blocks and a limited-use axe. It is not, and never was, a top-down grid puzzle.

**Reasoning.** v1 described top-down movement, block pushing, a carried
inventory and key-and-door locks. That is a different game. Every level, every
mechanic card and the whole validator model were being built against it, so the
error compounded with each card certified. Voiding it now costs one engine;
voiding it after Gate I ships costs the levels too.

### Discarded

| v1 concept | Why it goes |
| --- | --- |
| Top-down grid movement | Replaced by side view with gravity (§12–13) |
| Block **pushing** (v1 §13) | No pushing in v2. Blocks are **broken**, with an axe, permanently |
| Carried inventory, 3-item cap, drop-oldest (v1 §12) | No inventory. Jewels are collected, not carried; the axe is a use counter |
| Keys and doors (v1 §14) | No locks. The gate opens when the last jewel is taken (§7) |
| Torches and lighting (v1 §15) | Gone. Darkness is aesthetic, not mechanical |
| Safe / standard / expert routes and timers (v1 §9, §16) | One route standard per level. Death, not the clock, is the pressure |
| Optional treasure (v1 §9) | Every jewel is required; that is what makes "collect them all" complete |
| Room transitions carrying inventory (v1 §11) | Nothing carries between levels (§11). Each level proves in isolation |
| Isometric 3/4 camera with smooth pan (v1 §30) | Fixed camera, one screen, integer scaling, no movement (§12, §30) |

### Kept

- **The deadlock-free guarantee and its language** (v1 §8 → v2 §8), restated
  against the v2 goal: from every reachable non-death state the player can still
  collect the remaining jewels and reach the gate. "No reachable state is dead"
  is still the bar.
- **The validator as a merge gate** — `npm run validate` is still not advisory,
  a truncated search is still a failure, and a level that cannot be proven does
  not ship.
- Seven gates, ~37 levels, the Inanna descent narrative and the regalia
  progression (§6, §21).
- Mesopotamian palette and theme (§17), now at 16×16.
- Platform and delivery in full: TypeScript, Phaser 3, PWA, Cloudflare Pages,
  touch / controller / keyboard (§2).
- Definition of Done, playtest rubric, certification bar, PR quality bar, build
  and deployment, the critical-path doc discipline and the board workflow
  (§20, §48–53).
- The architecture in ADR-001: engine-free `src/core/`, the `src/` layout, the
  four commands, CI. None of it was top-down-specific.

### New in v2 that has no v1 ancestor

Fixed jump arc with no variable height (§13) · ladders (§14) · breakable blocks
and limited axe uses (§15) · deterministic guardians (§16) · jump-clearance
proof (§19) · timing-margin floor per gate (§19, §25) · Gate I's
no-repeated-deaths rule (§25).

**Section numbers 20 and 24–53 keep their v1 meanings**, so references to
SPEC 20, 25, 31, 48, 49, 50, 51, 52 and 53 elsewhere in the repo remain correct.
Sections 7–19 are the rewrite, and anything citing SPEC 12–16 for inventory,
blocks, keys or torches is citing a void rule.

**How to reverse.** Restore `docs/SPEC.md` from `2072028` and revert the board.
Reversing is only sensible before any v2 level ships; after that the levels
encode v2 geometry and would have to be rebuilt too.

**Consequence for `CLAUDE.md`.** Its §1 "Deadlock rules" restates v1 §12–§16 —
inventory limits, block pushing, keys and doors, torches. Those subsections are
now void. The file still correctly says SPEC wins where they disagree, but it
should be rewritten against v2 before lanes resume; until then a lane reading it
will implement mechanics this game does not have.
