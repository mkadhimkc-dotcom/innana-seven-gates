# Inanna: Seven Gates — Game Design Document

## 1. High concept
Inanna: Seven Gates is a 2D Mesopotamian puzzle-platformer where you navigate a goddess through seven gates, each guarded by challenges. Solve deadlock puzzles, manage inventory, and find safe paths. Phone-first with TV mirroring and Bluetooth controller support.

## 2. Platform and delivery
- Phone: iOS and Android via PWA (installable), runs in web browser
- TV: AirPlay or Chromecast mirroring from phone; native TV app (tvOS/Android TV) is optional post-launch
- Input: touch (phone), Bluetooth Xbox/PlayStation controllers, keyboard (debug)
- Tech: TypeScript, Phaser 3, installable as progressive web app (PWA)
- Hosting: Cloudflare Pages (free tier, 500 builds/month)

## 3. Genre and player experience
Players solve step-by-step puzzles under time pressure. Learn rules in Gate I, combine mechanics in Gates II–IV, and master them in Gates V–VII. Deadlock-free: every level is always solvable from the current state. Checkpoints with safe-state recovery prevent soft-locks.

## 4. Target audience
Casual puzzle fans, ages 10+. Players familiar with Sokoban, Portal, or Zelda; comfortable with spatial reasoning and inventory management.

## 5. Progression model
- **Teach** (Gate I): one mechanic per level
- **Practice** (Gate II): combine two mechanics
- **Combine** (Gates III–IV): three or more mechanics, time pressure
- **Challenge** (Gates V–VI): expert routing and quick decisions
- **Master** (Gate VII): final trial, highest difficulty
- **Replay** (New Game+): visual variants, new item placements, harder routes

## 6. Structure: 7 gates, ~37 levels
- Gate I (Tutorial): 4 levels
- Gate II: 5 levels
- Gate III: 5 levels
- Gate IV: 5 levels
- Gate V: 5 levels
- Gate VI: 5 levels
- Gate VII: 3 levels (final)
- New Game+: 6 unlockable levels with procedurally seeded variant placements

## 7. Core mechanic: inventory-based state
The player carries items (keys, torches, etc.). Picking up an item changes the world state. Putting it down changes it again. Pushing blocks changes state. Solving the puzzle means reaching a state where you can exit.

## 8. Deadlock definition and prevention
A **deadlock** occurs when you're in a state where no reachable action sequence leads to the exit. Example: you pushed a block into a corner, trapping it, and you need that block to proceed. Deadlocks are **forbidden by design**. Every level passes a validator that proves: from every reachable state, there exists a path to the exit.

## 9. Level structure
Each level is a single room:
- Tiles: floor, wall, water, lava, spike, goal tile
- Entities: player, NPCs (statues), blocks (pushable), items
- Safe route: the easy path, no time pressure
- Standard route: moderate difficulty, 60-second timer
- Expert route: hard, 30-second timer
- Critical path: the sequence of actions required to reach the goal
- Treasure: optional items that unlock cosmetics in New Game+, never required

## 10. Checkpoints and safe saves
A checkpoint saves the player's position and inventory only when:
1. The exit is still reachable from that state (validator confirms this)
2. The player is not trapped

If the player becomes trapped (no path to exit, required items out of reach), they return to the last safe checkpoint automatically.

## 11. Room transitions and player recovery
When the player moves between rooms (exit → next level entrance), they retain their inventory. If they enter a room where an item was picked up in a previous session, the item stays gone.

## 12. Inventory limits
The player can carry up to 3 items. Picking up a 4th item drops the oldest one at the player's feet.

## 13. Block mechanics
Blocks are 1×1 tiles. The player pushes them by moving into them. Blocks cannot be pulled. Blocks stop at walls. Blocks can be pushed into water or lava (they sink and disappear, one-way). Blocks cannot be pushed into spikes (they stop before the spike).

## 14. Keys and doors
Keys open doors of matching color. Picking up a key doesn't consume it; the player carries it. Doors stay open after unlocking. Keys can be dropped and picked up again.

## 15. Torches and lighting
Torches illuminate dark tiles (tiles with no light source nearby). A tile with a torch is lit. Tiles within 3 cells of a lit tile are also lit. Dark tiles slow the player (50% movement speed). Torches can be dropped and picked up.

## 16. Time pressure routes
Safe route: no timer. Standard route: 60-second timer. Expert route: 30-second timer. Timer runs down visually on screen. If time runs out, the level restarts from the last checkpoint.

## 17. Visual theme
Mesopotamian aesthetic: clay brick walls, sandy floors, cuneiform tile patterns. Color palette: terracotta, gold, deep blue, lapis lazuli. Spikes and hazards in red. Water in cyan. Lava in orange. Player character is a semi-transparent silhouette (goddess form).

## 18. Validator: solvability proof
For each level, the validator builds a state graph:
- Nodes: reachable (player position, inventory state, block positions)
- Edges: valid moves from each node
- Proof: from every reachable node, there exists a path to the exit node
- If proof fails, the level has a dead state. The report names the state and a seed to reproduce it.

## 19. Validator: deadlock detection (block-specific)
For levels with blocks (Gates III+), run a block deadlock detector:
- Detect irreversible block pushes (block pushed into a corner or against a wall where it cannot be retrieved)
- Confirm that the puzzle is still solvable even if that block is lost
- If not, flag it as a deadlock and fail validation
- Must complete in under 1 minute per level

## 20. Definition of Done for levels
1. Critical-path doc answers all 52 questions in Section 52
2. Validator finds no dead states; bots find no softlocks
3. Safe, standard, and expert routes present; optional treasure never required
4. Difficulty within the gate's target range (inspector confirms)
5. First-time, experienced, and adversarial playtests pass
6. Level is Certified in the build board before it can ship

## 21. NPCs and narrative
NPCs are statues that guard gates. They give hints about the puzzle. Hints are one sentence. The player does not interact with NPCs (no dialogue, no trades). The seven gates correspond to the seven underworld gatekeepers in the Inanna myth. Each gatekeeper removes one piece of Inanna's regalia as she descends. In this game, each gate removes one ability (e.g., after Gate II, no more torches are found; after Gate IV, no more multi-item puzzles). By Gate VII, Inanna is reduced to her essence.

## 22. Aesthetic progression
Gate I: bright, warm, open. Gate VII: dark, cold, narrow. The visual style shifts from hopeful to ominous.

## 23. Audio design
Ambient music per gate (looping, non-intrusive). Sound effects: block push, key pickup, door unlock, checkpoint save, item drop. No voice acting. No diegetic (in-world) music.

## 24. Difficulty curve
Gate I: 1 mechanic per level. Gate II: 2 mechanics combined. Gate III: 3 mechanics, first time pressure. Gate IV: expert routes introduced, time limit tightens. Gate V: no new mechanics, maximum complexity. Gate VI: mastery checks. Gate VII: final trial (3 levels, 1 is the hardest, 1 is the shortest, 1 is the most complex).

## 25. Difficulty targets (inspector confirms)
Gate I: 1–2 minutes per level. Gate II: 2–3 minutes safe, 30 sec expert. Gate III: 3–5 minutes safe, 30 sec expert. Gate IV: 4–6 minutes safe, 20 sec expert. Gate V: 5–8 minutes safe, 15 sec expert. Gate VI: 6–10 minutes safe, 10 sec expert. Gate VII: 10+ minutes safe, 5 sec expert (final level).

## 26. New Game+ mode
After beating Gate VII, unlock New Game+. Same 37 levels, but:
- Items spawn in new locations (procedurally seeded per level)
- Visual variants: alternate color schemes, object skins
- Modifiers: "No drops" (can't drop items), "Single torch" (only one torch exists in level), "Speed run" (shorter timers)
- Treasure pickups reward cosmetics: alternative player skins, level borders, HUD themes

## 27. Mobile input: touch
Two fingers on screen: left side moves, right side acts (push block, pick up item). Swipe up to open inventory. Pinch to zoom (optional). No page scroll or text selection during play. Configurable left-handed layout.

## 28. Controller input
Xbox and PlayStation controllers supported via Bluetooth. Button map:
- D-pad: move
- A / X: push/pick up
- X / Square: drop item
- Y / Triangle: open inventory
- LB / L1: cycle camera or level select (menu)

## 29. Keyboard input (debug only, not in release)
Arrow keys: move. Space: push/pick up. D: drop. I: open inventory. R: restart from checkpoint. L: load from last save. E: end level (skip).

## 30. Camera and viewport
Isometric 3/4 view, fixed camera per room. Camera follows the player (smooth pan). No camera rotation. Viewport is 16:9, scales to phone and TV. Objects scale smoothly on pinch zoom (phone only).

## 31. Performance budget
Target 60 FPS on mid-range phones (iPhone 12, Pixel 6 or newer). Max 5 MB bundle size (uncompressed). Preload next level in background during play.

## 32. Accessibility
- Text size options (small, normal, large)
- High-contrast mode (black background, bright text)
- Colorblind modes: protanopia, deuteranopia, tritanopia
- No flashing (seizure safety)
- Subtitle option for audio cues (text description of sounds)

## 33. Save system
Saves are local to the device (localStorage in browser, app sandboxed storage on native). Saves per level: checkpoint + best times (safe, standard, expert). No cloud sync. New Game+ data stored separately.

## 34. Menu structure
- Main menu: start, continue, settings, credits, exit
- Pause menu (during level): resume, restart from checkpoint, level select, settings
- Level select: browse gates, view times, view treasure, unlock New Game+ levels
- Settings: volume, difficulty preset (assists off/on), accessibility options, controls config

## 35. Assists and difficulty presets
- No assists: standard rules, no time limit on safe route
- Assists on: extended time limits (1.5x), bigger inventory (5 items), checkpoint every 30 seconds, visual hints on interactable objects
- Custom: player picks individual assists

## 36. Localization and languages
English launch. Potential post-launch: Spanish, French, German, Mandarin, Arabic. Asset-based (icons, not text-heavy) to reduce localization burden.

## 37. Monetization
Free game, no ads, no in-app purchases. Funded internally. No tracking or telemetry.

## 38. Credits and attribution
- Design: Mohammed Kadhim
- Engineering: Claude (Anthropic) via Claude Code
- Art: Procedurally generated (code-drawn vectors, no external assets)
- Audio: Open-source SFX library + original ambient music (TBD)
- Mythology: Inanna myth from Sumerian sources

## 39. Platform-specific features
- **Phone**: vibration feedback on block push (haptics), home screen badge for achievements
- **TV**: party mode (multiple controllers, upcoming feature)
- **Web**: screenshot share button, replay export (JSON timeline)

## 40. Testing strategy
Unit tests: validator, state graph, block deadlock detector. Integration tests: level load, checkpoint save, route completion. Playtests: first-time, experienced, adversarial (AI bots). QA approval: all three playtests must pass before a level ships.

## 41. Release milestones
- Phase 1 (Playable slice): Gate I complete, 4 levels certified, core systems playable
- Phase 2 (Gates II–IV): 14 levels certified, all mechanics introduced
- Phase 3 (Gates V–VII): 37 levels certified, game feature-complete
- Phase 4 (New Game+): cosmetics, seeded placements, modifiers
- Phase 5 (Launch): iOS/Android store (optional, paid native wrappers)

## 42. Known risks and mitigation
- **Deadlocks in complex levels**: mitigated by mandatory validator pass before certification
- **Performance on low-end phones**: mitigated by performance budget and early profiling
- **Player confusion about mechanics**: mitigated by Gate I teaching one rule at a time
- **Soft-lock from trapping player**: mitigated by auto-return to checkpoint and trapped-player detection

## 43. Future content (post-launch)
- Level editor for player-created puzzles
- Leaderboards for speedrun times
- Seasonal challenges (time-limited puzzle variants)
- Mythology deep-dive (lore unlocks as you complete gates)

## 44. Comparison to reference games
- **Sokoban**: block-pushing, deadlock-free design (similar core)
- **Portal**: puzzle mechanics stacked on top of each other (similar structure)
- **Zelda**: inventory-based progression, item gating (similar progression)
- **Doodle Jump**: phone-native, tilt controls (different genre, similar platform fit)

## 45. Unique selling point
**Deadlock-free guarantee**: every puzzle is always solvable. No "undo" button, no soft-lock traps. The validator proves it before you play.

## 46. Art direction rules
- No realistic shading (flat color fills)
- No particle effects (performance)
- Lines drawn in black or dark gold (1–2px)
- Blocks have a single highlight edge to show pushability
- Animation: idle sway, walk cycle, push pose (3-frame sprites)

## 47. Music and SFX strategy
- Ambient tracks: 1–2 per gate, 2–3 minute loops
- SFX: 8-bit chiptune style for feedback (block push, pickup, unlock)
- Silence is okay (not every action needs sound)
- Music fades when player is near a clue NPC (subtle hint)

## 48. Playtesting rubric (Definition of Done)
**First-time playtest** (new player, no hints):
- Can reach the goal on safe route within time limit
- No confusion about input or controls
- Level takes between 1–10 minutes to complete

**Experienced playtest** (familiar with the game):
- Can beat standard route within 60 seconds
- Finds the critical path intuitively
- No frustration or exploits

**Adversarial playtest** (bots trying to softlock):
- Bots cannot find a way to trap the player
- All recoverable traps are detected and blocked
- Validator confirms no dead states

## 49. Certified level requirements
A level is Certified when:
- All three playtests pass
- Validator reports zero dead states
- Block deadlock detector (if applicable) passes
- Critical-path doc is complete and accurate
- Difficulty is within the gate's target range

## 50. Pull request quality bar
Every PR from a routine must:
- Pass `npm test` (unit tests)
- Pass `npm run validate` (deadlock and reachability check)
- Pass `npm run bots` (adversarial playtesting)
- Pass `npm run e2e` (smoke test gameplay)
- Update board/BOARD.md to reflect card status change

## 51. Build and deployment
Develop branch: every merge triggers a Cloudflare Pages build. Build must pass validation before it's live. Main branch: only for releases (post-playtest). Rollback: revert the commit and push.

## 52. Critical-path doc template (answer these 52 questions)
Every level must have a doc answering:
1. What is the goal tile location?
2. What is the goal item (if any)?
3. What is the player's starting position?
4. What is the starting inventory?
5. What is the safe route in plain English?
6. How many moves does the safe route take?
7. What is the standard route?
8. How many moves does the standard route take?
9. What is the expert route?
10. How many moves does the expert route take?
11. What block positions are used? (list coordinates)
12. Are any blocks pushable off the map? If so, which and why?
13. What keys and doors are used?
14. What torches are used, and where?
15. What water or lava hazards are present?
16. What spikes are present, and where?
17. Can the player become trapped in any state? (must be "no")
18. What is the difficulty? (1–10 scale per gate)
19. Is this level within the gate's difficulty target? (yes/no)
20. What mechanics are taught or combined in this level?
21. What is the checkpoint save strategy?
22. Are there any optional treasure items?
23. If yes to 22, what are they and where are they?
24. Can the player complete the level without collecting treasure?
25. What is the critical path in pseudocode?
26. What is the deadlock risk (if any)?
27. How did validation pass? (reference validator output)
28. What did the first-time playtest reveal?
29. What did the experienced playtest reveal?
30. What did the adversarial playtest reveal?
31. Are there any frame-perfect inputs required?
32. What is the lighting situation (dark tiles)?
33. Are there any NPCs (statues) with hints?
34. What do those hints say?
35. Is there a view obstruction (camera angle limitation)?
36. What is the time limit for standard route?
37. What is the time limit for expert route?
38. Is this level replayable in New Game+ with variants?
39. What variant placements are used for New Game+?
40. Does this level teach any new mechanic for the first time?
41. If yes to 40, what mechanic and which gate?
42. What mechanic is this level practicing or mastering?
43. What is the visual theme (gate-specific)?
44. Does the difficulty progression make sense from the previous level?
45. Is the narrative progression (gatekeepers, regalia removal) respected?
46. Are there any known exploits or softlocks?
47. What did the validator report (must be "all clear")?
48. Did the bots find any softlocks?
49. What was the average completion time in playtests?
50. Is this level fun? (playtest feedback)
51. Does it feel fair? (player perception)
52. Is this level ready to ship? (yes/no, must be "yes")

## 53. Board workflow (routine automation)
The Scrumban board has six columns:
- Backlog: not started (91 cards)
- Ready: waiting to start (limit 8, filled when Backlog < 3)
- Building: active work (limit 2)
- Validating: blocked, waiting for fixes (limit 3)
- Human QA: waiting for playtest (limit 3)
- Certified: done, ready to merge to main

Routines move cards automatically. Humans merge PRs and playtest. Every level waits for playtests. When Human QA is full, routines skip level cards and continue building non-level cards (systems, tools, art). This keeps testing pace with building.
