# These levels are superseded

Everything in `levels/` was authored against **SPEC v1**, the top-down grid
puzzle with pushable blocks, keys and doors. That model is void — see
`docs/DECISIONS.md` D-005 and `docs/SPEC.md` v2.

**Nothing here is a v2 level.** `gate-01-01` is a top-down room with a key, a
door and a pushable block. v2 has none of those things.

## Why it is still here

It is not deleted because the v2 schema does not exist yet (card **F-05**). Until
it does, this level is the only thing keeping `npm run validate`, the levels test
and the end-to-end smoke test exercising a real level end to end. Deleting it now
would leave the pipeline green over nothing, which is worse than leaving a level
that is honestly labelled obsolete.

## What happens to it

Once F-05 lands the v2 schema and the first v2 level exists, this directory is
emptied and `src/core/level.schema.json` goes with it. Card **L-00** builds the
first real v2 level from `docs/SPEC.md` and the v2 schema — never by copying
anything here.

Do not build a v2 level from these files. Do not extend them. Do not treat their
critical-path doc as a template; SPEC 52's 52 questions were rewritten for v2.
