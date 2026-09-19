# Reconciling the King's Valley replication spec with SPEC v2

**Status: analysis only. Nothing in SPEC v2, the board or the code has been
changed on the strength of this document.** Three of its rules would void the
deadlock-free guarantee, and that is an owner decision, not a lane's.

The document is a detailed replication spec for Konami's *King's Valley* (1985)
on mobile. SPEC v2 already takes that game as its idiom, so most of it is a
welcome sharpening of detail we did not have. But it is a spec for *replicating
King's Valley*, and this project is not replicating King's Valley — it is
building a game in that idiom **with a machine-checked promise the original
never made**. Where the two collide, the collision is at the promise.

---

## A. Fatal — adopting these ends the deadlock-free guarantee

These are not expensive. They are load-bearing walls.

### A1. Enemy AI is player-reactive and random (§4.2)

All four mummy classes break SPEC v2 §16:

| Class | The document says | What it breaks |
| --- | --- | --- |
| White/Grey | "**50% chance** to take a ladder" | Randomness |
| Yellow/Gold | "Calculates **Y-distance to Player** at every ladder/stair intersection" | Player-seeking |
| Red | "Performs a forward horizontal jump across 2-tile gaps **to pursue player**" | Player-seeking |
| Blue/Pink | "**Randomly** reverses direction upon **proximity to player**" | Both |

SPEC v2 §16: *"No randomness anywhere in guardian behaviour: no random turns,
no random waits, no player-seeking, no reaction to player position. A guardian's
position is a pure function of the number of frames elapsed since the level
started."*

**Why this is fatal, not merely expensive.** §18's proof walks a finite state
graph. Guardian phase is one small integer in that state precisely because
position is `f(guardian, phase)`. Make position depend on the player and it
becomes `f(guardian, entire play history)` — the guardian is no longer a
function of the state, it is a function of the path taken to reach the state.
Two states that look identical are no longer interchangeable, the graph stops
collapsing, and there is nothing finite left to search. Randomness is worse
again: there is no single successor state to search *toward*.

This is exactly why card **S-08** was voided rather than rewritten. Its "chaser"
was one of these four classes.

**If adopted:** T-20, T-21 and T-22 cannot be built. SPEC §8, §18, §19 and §45
— the unique selling point — go with them, along with the validator, the bots'
dead-state hunt, and the certification rule that depends on them.

### A2. Soft-locks are permitted, with a suicide button (§5.2.3)

The document says:

> **Soft-Lock (Trapped State):** Occurs when player digs into an enclosed pit
> with no ladders, stairs, or pickaxes remaining to escape.
> **Mandatory UI Requirement:** Pause Menu MUST include a "Self-Sacrifice /
> Retry Stage" command.

SPEC v2 §45: *"**Deadlock-free guarantee**: every level is always completable.
No undo, no soft-lock traps. The validator proves it before you play — and in a
game whose core verb permanently destroys terrain, that proof is the whole
trick."*

These are opposite designs, not different emphases. The original *King's Valley*
has soft-locks and hands you a suicide key; this project's entire reason for
having a validator is to prove they cannot happen. **You cannot ship both.** If
the validator works, the suicide button is dead code. If soft-locks are
permitted, the validator has nothing left to prove and §8, §18, §45 and the
whole certification pipeline are decoration.

### A3. Mummies fall into dug holes and get stuck (§4.3)

> Any mummy walking over a dug-out tile falls into the opening… trapped for 180
> frames… then climbs out.

Even with a perfectly deterministic patrol, this makes a guardian's position
depend on **where the player dug and when** — history again, not phase. It
breaks D-007's "guardian position is derived, never stored" for the same reason
A1 does, one step less obviously.

It is also, mechanically, the most *King's Valley* thing in the document. Losing
it costs real character.

---

## B. Expensive — adoptable, but each one costs state-space or a card

### B1. Two jump arcs, not one (§2.5)

> Horizontal displacement = 2.0 tiles forward (**if jumping while walking**) or
> 0 tiles (**if jumping in place**).

SPEC v2 §13 says *one* arc. Two is fine for the proof — T-21 sweeps two arc
shapes instead of one — but §13 and card S-21's criteria both need amending
before S-21 is built. **S-21 is currently first in Ready and this is exactly the
detail it would hard-code.**

Everything else in §2.5 agrees with v2 and sharpens it usefully: 0% mid-air
control, ceiling contact kills upward velocity, snap-to-floor landing.

### B2. Stairs as a tile type (§1.2, §2.4)

`STAIR_LEFT` / `STAIR_RIGHT` with diagonal 1:1 traversal are not in v2's tile
set (`empty`, `solid`, `breakable`, `ladder`, `gate`, `spikes`). The coverage
guard will refuse any level using them until they are modeled — working as
designed. Needs: a tile-kind addition, movement rules, a new vertical state, and
the §8.2 ladder/stair intersection priority rule. **One new card.**

### B3. Two consumables at capacity 9 each (§3.1)

Pickaxe **and** throwing knife, up to 9 of each. v2 has one axe, uses capped at
4, because §9's budget is what keeps §18's graph inside its one-minute proof.
Two counters at 0–9 multiply the state space by 100 where v2 budgeted for 5.
Plus knives are projectiles: a live projectile is more state again (position,
direction, per frame).

Adoptable at v2's caps (e.g. 4 axe uses, no projectiles) or with a re-measured
budget. Not adoptable at 9 and 9 without re-opening §19's one-minute promise.

### B4. Level timer (§5.2.2)

`LEVEL_TIMER` counting to zero as a death condition. v2 discarded timers in
D-005. A timer adds remaining-time to the state, and it interacts badly with
§19's timing-margin proof — a route that clears a guardian with margin may still
fail on the clock. Adoptable, but it is a state component and a second failure
mode to prove against.

### B5. Score, lives, coffin spawns (§3.1, §5.1, §4.4)

Score and bonus points are presentation and cost nothing. **Lives** and
**enemy spawn-from-coffin** are state. §8.4's respawn safety buffer is a good
rule and cheap.

---

## C. Free — adopt outright, it is better than what v2 says

- **§1.1** 60 Hz fixed tick, tick-deterministic not frame-delta. Already built
  (`src/core/clock.ts`, S-20). The document's insistence is a welcome second.
- **§1.1** 16×12 grid sits inside v2's 32×24 cap.
- **§2.1** 12×14 hitbox inside a 16×16 tile, bottom-centre anchor, snap-to-grid
  on stop. v2 says nothing this precise and should.
- **§2.2** The full player FSM. More rigorous than v2 §13 and compatible with it.
- **§2.7** Digging as a 45-frame locked animation with the tile changing at
  frame 30. v2 never said breaking took time. This matters to the proof: a
  locked 45-frame window next to a patrolling guardian is a timing-margin
  question, and §19 should know about it.
- **§6** The 4-pixel / 4-frame input buffer and ladder auto-centre. Genuinely
  good mobile design, and card P-02's best available spec.
- **§8.1** Knife-kill beats mummy-contact on the same frame. Exactly the kind of
  tie-break a deterministic engine must state.
- **§8.3** No air-digging.
- **§7.1** The loop order. Matches what S-20 built.

---

## D. The decision

**B and C are ordinary work** — cards, amendments, a re-measured budget. They
can be scheduled.

**A is one question, and everything else waits behind it:**

> Does this project keep the deadlock-free guarantee, or does it replicate
> *King's Valley* faithfully?

**Option 1 — keep the guarantee.** Guardians stay deterministic and
phase-derived. Adopt the document's tile detail, hitbox, FSM, dig timing, input
buffering and tie-breaks. Reject §4.2's four AI classes, §4.3's hole-trapping,
and §5.2.3's soft-lock-with-suicide-button. The game plays like *King's Valley*
with enemies you learn rather than enemies that chase you, and the validator
keeps working.

**Option 2 — replicate faithfully.** Adopt §4 and §5.2.3. Delete the
deadlock-free guarantee from SPEC §8, §18, §19 and §45; void T-20, T-21, T-22,
the bot dead-state hunt, and the certification rule's dependence on the
validator; ship the suicide button instead. This is a legitimate game. It is not
the game the last nine cards were built for.

**There is no option 3.** A player-reactive guardian and a machine-checked
completability proof cannot coexist — not because of effort, but because the
proof quantifies over a state space that player-reactive AI does not have.

**Recommendation: Option 1**, and not by a small margin. The guarantee is the
project's stated unique selling point (§45), it is what the architecture,
validator, board and certification rule were all built to serve, and it is the
one thing this game would have that the 1985 original does not. Deterministic
patrols cost some of the original's menace; they buy a game where "I am stuck
and did not know it" cannot happen. If the menace is what is missing, it can be
bought back with tighter patrol gaps and more guardians — §25's timing-margin
floors exist precisely to keep that tuning honest.
