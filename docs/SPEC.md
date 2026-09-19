# Inanna: Seven Gates — Game Design Document (v2)

> **v2 supersedes v1.** v1 described a top-down grid puzzle with block pushing,
> key-and-door locks and a carried inventory. That model is void. This game is a
> **side-view platformer** in the idiom of Konami's *King's Valley* (MSX, 1985).
>
> What v1 got right and v2 keeps: the deadlock-free guarantee, the validator
> that proves it, the seven-gate structure, the Mesopotamian theme, and the
> platform and delivery story. See `docs/DECISIONS.md` D-005 for the full list
> of what survived and what was discarded.
>
> Section numbers 20 and 24–53 are unchanged in meaning from v1, so references
> to them elsewhere in the repo remain correct. Sections 7–19 are the rewrite.

## 1. High concept
Inanna: Seven Gates is a side-view 2D platformer set in a Mesopotamian
underworld. Each level is a single screen of brick and ladder. Collect every
jewel in the room and the gate opens; step through it and descend to the next.
Seven gates, each darker and tighter than the last. Guardians patrol fixed
routes and kill on contact. Phone-first with TV mirroring and Bluetooth
controller support.

## 2. Platform and delivery
- Phone: iOS and Android via PWA (installable), runs in web browser
- TV: AirPlay or Chromecast mirroring from phone; native TV app (tvOS/Android TV) is optional post-launch
- Input: touch (phone), Bluetooth Xbox/PlayStation controllers, keyboard (debug)
- Tech: TypeScript, Phaser 3, installable as progressive web app (PWA)
- Hosting: Cloudflare Pages (free tier, 500 builds/month)

## 3. Genre and player experience
Players read a room, find the route that collects every jewel, and execute it
past guardians whose patrols they have learned. The pleasure is the same as
*King's Valley*: a screen that looks impossible until you see the order it has
to be done in, then becomes easy.

Deadlock-free: every level is always completable from the current state.
Checkpoints with safe-state recovery prevent soft-locks. Death is cheap and
frequent by design in later gates; being stuck is never possible.

## 4. Target audience
Players who like *King's Valley*, *Lode Runner*, *Solomon's Key* and *Montezuma's
Revenge*. Ages 10+. Comfortable with pattern learning and short-loop retry.

## 5. Progression model
- **Teach** (Gate I): one idea per level, finishable first time without repeated deaths
- **Practice** (Gate II): two ideas at once; first breakable blocks
- **Combine** (Gates III–IV): guardians and breakables together; longer jewel routes
- **Challenge** (Gates V–VI): tighter patrol gaps, multi-stage routes
- **Master** (Gate VII): final trial, everything at once
- **Replay** (New Game+): seeded jewel and guardian placements, harder routes

## 6. Structure: 7 gates, ~37 levels
- Gate I (Tutorial): 4 levels
- Gate II: 5 levels
- Gate III: 5 levels
- Gate IV: 5 levels
- Gate V: 5 levels
- Gate VI: 5 levels
- Gate VII: 3 levels (final)
- New Game+: 6 unlockable levels with procedurally seeded variant placements

## 7. Core mechanic: jewels and the gate
Each level holds a fixed set of jewels. Collecting a jewel is permanent for that
attempt. When the last jewel is collected the gate opens. Entering the open gate
completes the level and descends to the next.

The puzzle is the **order and route**: which jewels to take first, which ledge to
reach before breaking which block, when to pass a guardian. There is no carried
inventory and no pushing.

## 8. Deadlock definition and prevention
A **deadlock** occurs when you're in a state where no reachable action sequence
collects the remaining jewels and reaches the gate. Example: you broke the block
you needed to stand on to reach the last jewel, and nothing else reaches it.
Deadlocks are **forbidden by design**. Every level passes a validator that
proves: from every reachable non-death state, there exists a path that collects
every remaining jewel and reaches the gate.

"The intended route works" is not the bar. "No reachable state is dead" is the
bar. Death is not a deadlock — death returns the player to a safe checkpoint
(§10) and is always recoverable. A dead *state* is one the player can still act
in and can never finish from.

## 9. Level structure
Each level is a single screen, no scrolling:
- **Tiles:** empty, solid brick, breakable block, ladder, gate, spikes
- **Entities:** player, jewels, guardians, axe/chisel pickups
- **A route:** the sequence of moves that collects all jewels and reaches the gate
- **Optional jewels do not exist.** Every jewel in the room is required; that is
  what makes "collect them all" a complete statement of the goal.

## 10. Checkpoints and death
Contact with a guardian or a spike kills the player. Death costs the attempt's
progress back to the last checkpoint, never the level.

A checkpoint stores the player's cell, the jewels collected, the blocks broken
and the axe uses remaining, and it is written **only when the validator confirms
the level is still completable from that state**. If no checkpoint has been
written, death restarts the level from its start state, which is completable by
construction.

The player can always restart the level deliberately from the pause menu.

## 11. Gate transitions
Entering the open gate ends the level. Nothing carries between levels: jewels,
broken blocks and axe uses are per-level. Each level's start state is fixed and
self-contained, which is what lets the validator prove a level in isolation.

## 12. View, tiles and scaling
- **Side view.** One screen per level. No scrolling, no camera movement.
- **16×16 pixel tiles.** A level is a fixed grid of them.
- **Integer scaling only.** The render target scales by a whole number to fit the
  viewport, letterboxed. No fractional scaling, no filtering — a 16×16 tile
  stays crisp on a phone and on a TV.
- **Two-frame animation at 8 fps.** Every animated thing is two frames, swapped
  eight times a second. Nothing has a third frame.

## 13. Movement: run, jump, fall
- **Run** left and right at a constant speed. No acceleration, no momentum.
- **Jump** a single fixed arc. The same jump every time: same height, same
  distance, same duration. Holding the button longer does nothing.
- **No double jump. No wall jump.** One jump, from the ground or from a ladder.
- **Gravity** applies whenever the player is not grounded or climbing.
- **Falls are safe at any height.** Landing never hurts. Only guardians and
  spikes kill.

The fixed arc is the point: it makes every jump in a level either possible or
impossible, never a matter of execution skill, and it is what lets §19 prove
clearance geometrically.

## 14. Ladders
Ladders occupy tiles. The player climbs up and down while overlapping one, and
can step off either side onto a solid tile. Jumping from a ladder uses the same
fixed arc. Guardians do not use ladders unless their route says so (§16).

## 15. Breakable blocks and the axe
Some blocks are **breakable**. Breaking one removes it permanently **for that
attempt** — until death returns the player to a checkpoint or the level start,
which restores the level's blocks to that saved state.

Breaking requires an **axe or chisel**, found in the level, with a **limited
number of uses**. One use either:
- breaks one breakable block, or
- kills one guardian.

Uses are not refunded. This is the main source of dead states in v2 — spending
the last use on the wrong block, or breaking the platform you needed — and
§18 exists to prove those states away before a level ships.

## 16. Guardians
Guardians patrol **fixed, cyclic routes**. Contact kills the player.

**Determinism is mandatory.** No randomness anywhere in guardian behaviour: no
random turns, no random waits, no player-seeking, no reaction to player
position. A guardian's position is a pure function of the number of frames
elapsed since the level started, and its cycle is finite. The solvability proof
depends on this; a guardian that reacts to the player makes the state space
unprovable, and any such proposal is a spec violation, not a design option.

A guardian can be killed with one axe use. A killed guardian stays dead for that
attempt.

## 17. Visual theme
Mesopotamian: clay brick walls, carved stone, cuneiform friezes. Palette of
terracotta, gold, deep blue, lapis lazuli. Spikes and hazards in red. Jewels in
bright lapis and gold. The player is a small, readable silhouette in goddess
form. Guardians are distinct in shape at 16×16, never only in colour (§32).

## 18. Validator: solvability proof (v2)
For each level the validator builds a state graph.

**A state is:**
- player cell
- vertical state: grounded, airborne with its phase within the fixed arc, or climbing
- jewels collected
- blocks broken
- axe uses remaining
- guardian phase (the tick within the guardians' combined cycle)

Every one of those is finite and every cycle is finite, so the state space is
finite and the graph terminates.

**Edges** are legal inputs from each state, advanced one simulation step.

**The proof:** from every reachable non-death state, the player can still
collect all remaining jewels and reach the gate.

**On failure** the report names the dead state and a seed that reproduces it:
the input sequence from the level start that arrives there.

The validator must also prove, and fail the level otherwise:
- **No jewel is unreachable.**
- **No axe is required but absent** — if any surviving route needs an axe use,
  the level provides enough uses.
- **No breakable block can be destroyed into an unwinnable state.**

## 19. Validator: jump clearance and timing margin
Two further proofs, both about execution rather than reachability:

**Jump clearance.** Every jump the solution requires must clear with headroom.
The fixed arc (§13) is swept tile by tile; if any tile the arc passes through is
solid — a ceiling, a block, a ledge corner — the jump does not clear and the
level fails validation. No jump whose arc clips geometry may appear on a
required route.

**Timing margin.** A required passage past a guardian must be passable with a
margin, never frame-perfect. The validator computes the window in which the
passage succeeds and fails the level if that window is below the margin for the
gate (§25). A safe route that needs frame-perfect input is a **validator
failure, not a matter of taste**.

Both must complete in **under 1 minute per level**.

## 20. Definition of Done for levels
A level is not done until **all six** hold. Not five. There is no partial pass.
1. Critical-path doc answers all 52 questions in §52
2. Validator finds no dead states; bots find no softlocks
3. Every jewel reachable, gate reachable, jump clearance and timing margin proven
4. Difficulty within the gate's target range (inspector confirms)
5. First-time, experienced, and adversarial playtests pass
6. Level is Certified in the build board before it can ship

## 21. Narrative and the seven gates
The seven gates are the seven underworld gates of the Inanna myth. Each
gatekeeper takes one piece of her regalia as she descends. In this game each
gate takes away an affordance: after Gate II there are fewer ladders; after
Gate IV the axe becomes scarce; by Gate VII she has almost nothing but the jump.
Guardians are the gatekeepers' statues, animate and indifferent.

## 22. Aesthetic progression
Gate I: bright, warm, open, wide platforms. Gate VII: dark, cold, narrow, long
drops. The visual style shifts from hopeful to ominous.

## 23. Audio design
Ambient music per gate (looping, non-intrusive). Sound effects: jump, land,
climb, jewel collect, gate open, axe strike, block break, guardian death,
player death. No voice acting. No diegetic music.

## 24. Difficulty curve
Gate I: one idea per level, no guardians until the last. Gate II: two guardians,
generous patrol gaps, first breakable blocks. Gate III: axe scarcity begins.
Gate IV: tighter gaps, routes that must be planned before moving. Gate V: no new
mechanics, maximum complexity. Gate VI: mastery checks. Gate VII: final trial
(3 levels — one longest, one shortest, one hardest).

## 25. Difficulty targets (inspector confirms)
Per level, first-time completion: Gate I 1–2 min · Gate II 2–3 · Gate III 3–5 ·
Gate IV 4–6 · Gate V 5–8 · Gate VI 6–10 · Gate VII 10+.

**Timing margin floor** for any required guardian passage, in frames at 60fps:
Gate I 20 · Gate II 16 · Gate III 14 · Gate IV 12 · Gate V 10 · Gate VI 8 ·
Gate VII 6. Below the floor is a validator failure (§19).

**Gate I additionally must be finishable by a first-time player without repeated
deaths.** A Gate I level where the adversarial playtest records repeated deaths
on the intended route is too hard for Gate I, whatever its completion time.

## 26. New Game+ mode
After Gate VII, unlock New Game+. Same 37 levels, but jewel and guardian
placements are seeded per level, visual variants swap palettes and skins, and
modifiers apply: "No axe", "One life", "Speed run". Every seeded variant is
validated like any other level — a variant that cannot be proven does not ship.

## 27. Mobile input: touch
On-screen controls: left/right on the left thumb, jump on the right thumb,
up/down for ladders, and a use-axe button. No page scroll, zoom or text
selection during play. Size, opacity and left-handed mirror are options.

## 28. Controller input
Xbox and PlayStation controllers via Bluetooth:
- D-pad / left stick: run, climb
- A / Cross: jump
- X / Square: use axe
- Start / Options: pause
- Disconnecting mid-game pauses safely

## 29. Keyboard input (debug only, not in release)
Arrows: run and climb. Space: jump. Z: use axe. R: restart from checkpoint.
L: restart level. E: skip level.

## 30. Camera and viewport
Fixed camera, one screen per level, no scrolling and no camera movement of any
kind. The render target is a whole number of 16×16 tiles, scaled by an integer
factor and letterboxed into a 16:9 viewport on phone and TV.

## 31. Performance budget
Target 60 FPS on mid-range phones (iPhone 12, Pixel 6 or newer). Max 5 MB bundle
size (uncompressed). Preload next level in background during play.

## 32. Accessibility
- Text size options (small, normal, large)
- High-contrast mode
- Colorblind modes: protanopia, deuteranopia, tritanopia. Guardians and hazards
  must differ in **shape**, not only colour
- No flashing (seizure safety)
- Subtitle option for audio cues
- Assists (§35) never change what the validator proved

## 33. Save system
Saves are local to the device (localStorage in browser, sandboxed storage on
native). Per level: furthest gate reached, best times, deaths. No cloud sync.
New Game+ data stored separately.

## 34. Menu structure
- Main menu: start, continue, settings, credits
- Pause menu: resume, restart from checkpoint, restart level, gate select, settings
- Gate select: browse gates, view times and deaths, unlock New Game+
- Settings: volume, assists, accessibility, controls

## 35. Assists and difficulty presets
- No assists: standard rules
- Assists on: extra checkpoints, slower guardians, extra axe uses
- Custom: player picks individual assists

Assists may only make a level **easier to execute**, never change its solution.
A level is validated without assists; assists must not open a route the proof
did not cover.

## 36. Localization and languages
English launch. Potential post-launch: Spanish, French, German, Mandarin,
Arabic. Asset-based (icons, not text-heavy).

## 37. Monetization
Free game, no ads, no in-app purchases. No tracking or telemetry.

## 38. Credits and attribution
- Design: Mohammed Kadhim
- Engineering: Claude (Anthropic) via Claude Code
- Art: Procedurally generated (code-drawn, no external assets)
- Audio: Open-source SFX library + original ambient music (TBD)
- Mythology: Inanna myth from Sumerian sources
- Idiom: Konami's *King's Valley* (MSX, 1985)

## 39. Platform-specific features
- **Phone**: haptics on jump, land and block break; home screen badge
- **TV**: party mode (multiple controllers, upcoming)
- **Web**: screenshot share, replay export (JSON input timeline)

## 40. Testing strategy
Unit tests: movement, jump arc, collision, guardian cycles, validator, state
graph. Integration tests: level load, checkpoint write, route completion.
Playtests: first-time, experienced, adversarial (bots). All three must pass
before a level ships.

## 41. Release milestones
- Phase 1 (Playable slice): Gate I complete, 4 levels certified, core systems playable
- Phase 2 (Gates II–IV): 14 levels certified, all mechanics introduced
- Phase 3 (Gates V–VII): 37 levels certified, feature-complete
- Phase 4 (New Game+): seeded placements, modifiers, cosmetics
- Phase 5 (Launch): iOS/Android store (optional, paid native wrappers)

## 42. Known risks and mitigation
- **Dead states from breaking blocks**: mitigated by the §18 proof before certification
- **State space explosion** from guardian phase × blocks broken: mitigated by finite cycles, and by the 1-minute budget in §19 acting as the tripwire
- **Frame-perfect routes shipping by accident**: mitigated by the §19 timing margin floor
- **Performance on low-end phones**: mitigated by the budget in §31 and early profiling
- **Gate I too hard**: mitigated by the explicit no-repeated-deaths rule in §25

## 43. Future content (post-launch)
Level editor · leaderboards · seasonal challenge levels · mythology lore unlocks.

## 44. Comparison to reference games
- ***King's Valley* (MSX, 1985)**: the idiom — single screen, collect all, dig/break, patrolling guards
- **Lode Runner**: breaking terrain as the core verb
- **Solomon's Key**: single-screen puzzle-platforming under a timer
- **Montezuma's Revenge**: room-as-puzzle, fixed hazards, learned routes

## 45. Unique selling point
**Deadlock-free guarantee**: every level is always completable. No undo, no
soft-lock, no unwinnable save. The validator proves it before you play — and in
a game whose core verb permanently destroys terrain, that proof is the whole
trick.

## 46. Art direction rules
- 16×16 tiles, integer scaling, no filtering
- Flat colour fills, no realistic shading, no particles
- Two-frame animation at 8fps, never three
- Lines in black or dark gold
- Breakable blocks visually distinct from solid at a glance
- Guardians distinct in silhouette, not only colour

## 47. Music and SFX strategy
Ambient tracks: 1–2 per gate, 2–3 minute loops. SFX in 8-bit chiptune style.
Silence is acceptable. Music thins as the gates descend.

## 48. Playtesting rubric (Definition of Done)
**First-time playtest** (new player, no hints):
- Completes the level
- No confusion about controls
- In Gate I specifically: completes without repeated deaths

**Experienced playtest** (knows the game):
- Finds the jewel route intuitively
- No frustration, no exploits
- No passage that feels frame-perfect

**Adversarial playtest** (bots hunting dead states):
- Bots cannot reach a state the level cannot be finished from
- Validator confirms no dead states
- Bots cannot find a jump that clips geometry

## 49. Certified level requirements
A level is Certified when all three playtests pass, the validator reports zero
dead states, jump clearance and timing margin pass, the critical-path doc is
complete and accurate, and difficulty is within the gate's target range.

## 50. Pull request quality bar
Every PR from a routine must:
- Pass `npm test` (unit tests)
- Pass `npm run validate` (solvability, clearance, timing margin)
- Pass `npm run bots` (adversarial playtesting)
- Pass `npm run e2e` (smoke test gameplay)
- Update `BOARD.md` to reflect the card's status change

## 51. Build and deployment
Develop branch: every merge triggers a Cloudflare Pages build. Build must pass
validation before it's live. Main branch: releases only. Rollback: revert and
push.

## 52. Critical-path doc template (answer these 52 questions)
Every level must have a doc answering:
1. Where is the gate?
2. How many jewels, and where is each?
3. Where does the player start?
4. What is the route, in plain English?
5. How many jewels must be collected before the gate opens? (always: all)
6. What order does the route collect them in?
7. Is any other order also valid?
8. How many jumps does the route require?
9. Does every required jump clear with headroom? (must be "yes")
10. What is the tightest jump on the route, in tiles of clearance?
11. Which tiles are solid brick?
12. Which tiles are breakable?
13. How many breakable blocks must be broken on the route?
14. Which breakable blocks must *not* be broken, and why?
15. Where are the ladders?
16. Where are the spikes?
17. Is there an axe or chisel? Where?
18. How many uses does it have?
19. How many uses does the route require?
20. What is the surplus? (uses provided minus uses required)
21. How many guardians are there?
22. What is each guardian's route and cycle length?
23. Is any guardian behaviour non-deterministic? (must be "no")
24. Which guardian passages are required by the route?
25. What is the timing margin on the tightest one, in frames?
26. Is that above the gate's floor in §25? (must be "yes")
27. Must any guardian be killed? Which, and why?
28. Can the player reach a state where the level cannot be finished? (must be "no")
29. What is the nearest miss — the state closest to being dead?
30. How did validation pass? (reference validator output)
31. How many states did the validator explore?
32. How long did validation take? (must be under 1 minute)
33. Where are checkpoints written?
34. Is every checkpoint state provably completable? (must be "yes")
35. What is the critical path in pseudocode?
36. What does the first-time playtest reveal?
37. What does the experienced playtest reveal?
38. What does the adversarial playtest reveal?
39. How many deaths did the first-time playtest record?
40. For Gate I: were there repeated deaths? (must be "no")
41. What is the difficulty? (1–10 within the gate)
42. Is this level within the gate's difficulty target? (yes/no)
43. What does this level teach, practise or master?
44. Does it introduce a mechanic for the first time? Which?
45. What is the visual theme for this gate?
46. Does the difficulty progression make sense from the previous level?
47. Is the narrative progression (regalia removed) respected?
48. Are there any known exploits?
49. Did the bots find any dead state or clipping jump?
50. What was the average completion time in playtests?
51. Is this level fun, and does it feel fair?
52. Is this level ready to ship? (yes/no, must be "yes")

## 53. Board workflow (routine automation)
The Scrumban board has six columns:
- Backlog: not started
- Ready: waiting to start (limit 8)
- Building: active work (limit 2)
- Validating: blocked, waiting for fixes (limit 3)
- Human QA: waiting for playtest (limit 3)
- Certified: done, ready to merge to main

Lanes move cards automatically per `docs/LANE.md`. Humans merge PRs and playtest.
When Human QA is full, lanes skip level cards and continue with non-level cards.
