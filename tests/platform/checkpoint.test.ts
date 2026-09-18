import { describe, expect, it } from 'vitest';
import { applyMove } from '../../src/core/state.js';
import { initialState, parseLevel } from '../../src/core/level.js';
import { isSafeCheckpoint } from '../../src/platform/checkpoint.js';
import type { GameState, Move } from '../../src/core/types.js';
import keyDoor from '../fixtures/solvable-key-door.json';
import deadlockFixture from '../fixtures/deadlock-block-on-goal.json';

const right: Move = { type: 'move', direction: 'right' };

describe('checkpoint safety (SPEC 10)', () => {
  it('saves a state the exit is still reachable from', () => {
    const level = parseLevel(keyDoor);
    const decision = isSafeCheckpoint(level, initialState(level));
    expect(decision.safe).toBe(true);
    expect(decision.reason).toBe('exit reachable');
  });

  it('refuses to save a state the player cannot escape', () => {
    const level = parseLevel(deadlockFixture);
    let state: GameState = initialState(level);
    for (let push = 0; push < 3; push += 1) {
      const next = applyMove(level, state, right);
      expect(next).not.toBeNull();
      state = next as GameState;
    }
    expect(isSafeCheckpoint(level, state).safe).toBe(false);
  });
});
