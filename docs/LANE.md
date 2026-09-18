# Lane operating procedure

Every lane runs this procedure. It takes one variable, **MODEL** — the model tag
the lane picks cards for (`opus`, `sonnet`, `haiku`). Substitute it wherever
MODEL appears.

A lane is autonomous. It does not ask the owner for opinions, and it does not
park work waiting for a reply. The only legitimate stop is something a machine
cannot do (step 12).

---

## 1. Start from a known commit

`git fetch origin develop`, then hard reset to `origin/develop`. State the HEAD
SHA you are working from. Every later claim in the run is relative to that SHA.

## 2. Read the ground truth

Read, in this order:

- `CLAUDE.md` (repo root) — the build rules
- `docs/SPEC.md` — the game design document, the source of truth
- `docs/DECISIONS.md` — decisions already resolved; do not re-litigate them
- `BOARD.md` (repo root) — the board

## 3. Health first

Check the newest GitHub Actions run on `develop`. If it is **red**: fix it, push
the fix, and confirm the run goes green.

If that consumes the whole run, **that is a successful run.** Report it per step
14 and stop. A lane that leaves `develop` green has done the most valuable thing
available to it, because nothing can be certified while CI is red (step 10).

## 4. First run only: clear stale cards out of Human QA

Any card in Human QA whose acceptance criteria are met, and whose merge commit's
CI run finished green, moves to **Certified**. This is a one-time sweep to drain
cards parked there before this procedure existed. Later runs skip this step.

## 5. Keep the queue full

If **Ready holds fewer than 3 cards**, move cards from Backlog into Ready in
dependency order until **Ready holds 8**.

Dependency order means no card sits above a card it depends on. A dependency
counts as met once its work is **merged** — the card is in Human QA or
Certified. A card still in Backlog, Ready, or Building is not met.

## 6. Pick a card

Take the **first** card in Ready whose line includes **`model: MODEL`** and
**`autopilot`**, and whose dependencies are all merged (in Human QA or
Certified).

If no card qualifies, reply **"No eligible card"** and stop.

## 7. Work the card

Work on branch `claude/<card-id>` until **every** acceptance criterion on the
card is met. Commit and push after each step that passes.

## 8. Prove it

Run all four:

```bash
npm test
npm run validate
npm run bots
npm run e2e
```

All must pass. A failure is work, not a footnote.

## 9. Merge

Merge into `develop`, push, and **wait for that merge commit's Actions run to
finish green**. A run still in flight is not a pass, and a green run on a
different commit is not this commit's run.

**Never report a result you have not watched.** If the run has not finished by
the end of the lane's time, say so and say which job was still going. A guessed
green is worse than an honest unknown, because the next lane builds on it.

## 10. Certification

When the acceptance criteria are met and CI on the merge commit is green, move
the card to **Certified**.

This includes **level cards**, provided all four hold:

- the validator reports no dead states,
- the bots find no softlock,
- the level is inside its gate's difficulty target (SPEC 25), and
- `docs/playtests/<card-id>.md` exists.

Every certified level is appended to `docs/PLAYTEST-QUEUE.md` as an unchecked
line. **That queue never blocks the pipeline** — it is a record of what the
owner may play, not a gate the lane waits on.

## 11. Scope: do not certify around a gap

If a card's acceptance criteria describe something **the codebase cannot yet
support**, do not quietly satisfy the criteria you can and certify the card.

Say so in the run report, and move the card to **Validating** with
`| blocked: scope` appended to its line and one line naming the gap. For
example:

```
- [ ] T-01 Solvability validator v1 | ... | blocked: scope
  - Criterion 1 wants switch states in the state graph; the engine has no
    switches yet. Needs switches implemented, or the card re-scoped.
```

This is the one case where partial work must not be dressed as done. A card
certified around a missing feature hides the gap behind a green tick, and the
next card to depend on it inherits a promise nothing keeps.

## 12. Decisions

If `docs/SPEC.md` is ambiguous, **resolve it against the spec yourself** and
carry on. Record in `docs/DECISIONS.md`:

- the decision,
- the reasoning that ties it back to SPEC, and
- how to reverse it.

**Never park a card waiting for the owner's opinion.** An unmade decision costs
the project more than a wrong one that is written down and reversible.

## 13. The only reason to stop for the owner

Something a machine cannot do: creating an account, paying for something, using
a physical device, or supplying a credential.

When you hit one, append **click-by-click steps** to `HUMAN.md`, then **pick a
different card and keep going**. The lane does not idle.

## 14. After a successful certify: move the rollback point

Once a card is certified and CI on that commit is green, **fast-forward `main`
to `develop`** and tag the commit `green-YYYY-MM-DD`.

```bash
git fetch origin develop main
git checkout main && git merge --ff-only origin/develop
git tag green-$(date -u +%F) && git push origin main --tags
```

Fast-forward only. If it will not fast-forward, stop and report it — `main` has
diverged and that is a fact the owner needs, not something to force past.

This is the rollback point SPEC 51 assumes exists. Production builds from
`develop`, so without this there is no known-good commit to revert *to*; the
tag is what makes "revert and push" a real option rather than an archaeology
exercise.

## 15. Never

- Never force-push. Not to `develop`, not to `main`, not to a `claude/**`
  branch someone else may have checked out.
- Never edit `docs/SPEC.md`.
- Never edit a card's acceptance criteria.

## 16. End every run with

1. The SHA you worked from
2. The card id
3. What changed
4. The CI result
5. The card's new column
6. Anything added to `HUMAN.md`

---

## MODEL = haiku: the sweep lane

Steps 1 to 5 and 11 to 16 apply unchanged. **Replace steps 6 to 10** with:

Run `npm run validate` and `npm run bots` across **every** level, then write
`reports/sweep-YYYY-MM-DD.md` containing:

- **Dead states**, each with the seed that reproduces it
- **Deaths by cause**, using the spec's cause categories
- **Levels outside their gate's difficulty target** (SPEC 25)

Commit the report.

**Report a red Actions run at the top of the reply**, before anything else in
the sweep. A red `develop` is the single most important thing a sweep can
surface, and it must not be buried under level tables.
