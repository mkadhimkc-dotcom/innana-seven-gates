import { describe, expect, it } from 'vitest';
import { applyMove, candidateMoves, describeMove, encodeState, parseAction } from '../../src/core/state.js';
import { initialState, parseLevel } from '../../src/core/level.js';
import { isGoal } from '../../src/core/board.js';
import type { GameState, LevelDefinition, Move } from '../../src/core/types.js';
import keyDoor from '../fixtures/solvable-key-door.json';
import deadlockFixture from '../fixtures/deadlock-block-on-goal.json';

function play(level: LevelDefinition, state: GameState, moves: readonly Move[]): GameState {
  return moves.reduce<GameState>((current, move) => {
    const next = applyMove(level, current, move);
    if (next === null) throw new Error(`illegal move: ${JSON.stringify(move)}`);
    return next;
  }, state);
}

const right: Move = { type: 'move', direction: 'right' };
const left: Move = { type: 'move', direction: 'left' };
const down: Move = { type: 'move', direction: 'down' };
const up: Move = { type: 'move', direction: 'up' };

describe('movement rules', () => {
  const level = parseLevel(keyDoor);

  it('refuses to walk into a wall', () => {
    expect(applyMove(level, initialState(level), up)).toBeNull();
    expect(applyMove(level, initialState(level), left)).toBeNull();
  });

  it('walks across floor tiles', () => {
    const next = applyMove(level, initialState(level), right);
    expect(next?.player).toEqual({ x: 2, y: 1 });
  });

  it('refuses a locked door until the matching key is carried (SPEC 14)', () => {
    const atDoor = play(level, initialState(level), [down, down, right, right]);
    expect(atDoor.player).toEqual({ x: 3, y: 3 });
    expect(applyMove(level, atDoor, right)).toBeNull();

    const withKey = play(level, initialState(level), [
      right,
      right,
      { type: 'pickup' },
      left,
      left,
      down,
      down,
      right,
      right,
      right,
    ]);
    expect(withKey.player).toEqual({ x: 4, y: 3 });
    expect(withKey.openDoors).toEqual(['door-gold']);
  });

  it('keeps a door open once unlocked, even after dropping the key', () => {
    const opened = play(level, initialState(level), [
      right,
      right,
      { type: 'pickup' },
      left,
      left,
      down,
      down,
      right,
      right,
      right,
      { type: 'drop', itemId: 'key-gold' },
      left,
      right,
    ]);
    expect(opened.openDoors).toEqual(['door-gold']);
    expect(opened.carrying).toEqual([]);
    const finished = applyMove(level, opened, right);
    expect(finished).not.toBeNull();
    expect(isGoal(level, finished as GameState)).toBe(true);
  });

  it('lets a dropped key be picked up again (SPEC 14)', () => {
    const dropped = play(level, initialState(level), [
      right,
      right,
      { type: 'pickup' },
      { type: 'drop', itemId: 'key-gold' },
      right,
    ]);
    expect(dropped.carrying).toEqual([]);
    expect(dropped.ground['key-gold']).toEqual({ x: 3, y: 1 });

    const backAgain = play(level, dropped, [left, { type: 'pickup' }]);
    expect(backAgain.carrying).toEqual(['key-gold']);
    expect(backAgain.ground['key-gold']).toBeUndefined();
  });

  it('refuses to drop an item the player is not carrying', () => {
    expect(applyMove(level, initialState(level), { type: 'drop', itemId: 'key-gold' })).toBeNull();
  });

  it('refuses to pick up from a tile with nothing on it', () => {
    expect(applyMove(level, initialState(level), { type: 'pickup' })).toBeNull();
  });
});

describe('block pushing (SPEC 13)', () => {
  const level = parseLevel(deadlockFixture);

  it('pushes a block one tile and steps into its place', () => {
    const pushed = applyMove(level, initialState(level), right);
    expect(pushed?.player).toEqual({ x: 2, y: 2 });
    expect(pushed?.blocks).toEqual([{ x: 3, y: 2 }]);
  });

  it('refuses a push that would drive the block into a wall', () => {
    const jammed = play(level, initialState(level), [right, right, right]);
    expect(jammed.blocks).toEqual([{ x: 5, y: 2 }]);
    expect(applyMove(level, jammed, right)).toBeNull();
  });

  it('never pulls a block (SPEC 13)', () => {
    const pushed = play(level, initialState(level), [right]);
    const backedOff = applyMove(level, pushed, left);
    expect(backedOff?.blocks).toEqual([{ x: 3, y: 2 }]);
  });
});

describe('state encoding', () => {
  const level = parseLevel(keyDoor);

  it('gives interchangeable states the same key', () => {
    const start = initialState(level);
    const thereAndBack = play(level, start, [right, left]);
    expect(encodeState(thereAndBack)).toBe(encodeState(start));
  });

  it('distinguishes states that differ only in inventory', () => {
    const start = initialState(level);
    const holding = play(level, start, [right, right, { type: 'pickup' }]);
    const standing = play(level, start, [right, right]);
    expect(encodeState(holding)).not.toBe(encodeState(standing));
  });

  it('offers a drop move for each carried item', () => {
    const holding = play(level, initialState(level), [right, right, { type: 'pickup' }]);
    const drops = candidateMoves(holding).filter((move) => move.type === 'drop');
    expect(drops).toEqual([{ type: 'drop', itemId: 'key-gold' }]);
  });
});

describe('action tokens (SPEC 9, 52 Q25 — routes and critical paths in level JSON)', () => {
  it.each([
    right,
    left,
    down,
    up,
    { type: 'pickup' } as const,
    { type: 'drop', itemId: 'key-gold' } as const,
  ])('parseAction inverts describeMove for %j', (move) => {
    expect(parseAction(describeMove(move))).toEqual(move);
  });

  it('rejects a token that is not a move, pickup, or drop', () => {
    expect(() => parseAction('sideways')).toThrow(/unknown action token/);
  });
});
