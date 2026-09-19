import { describe, expect, it } from 'vitest';
import {
  advanceSimulation,
  createSimulation,
  queueMove,
  simulationElapsedMs,
  type Simulation,
} from '../../src/core/simulation.js';
import { parseLevel } from '../../src/core/level.js';
import { encodeState, parseAction } from '../../src/core/state.js';
import type { Move } from '../../src/core/types.js';
import gate0101 from '../../levels/gate-01/gate-01-01.json';

const level = parseLevel(gate0101);
const STEP = 10;

const right: Move = { type: 'move', direction: 'right' };
const down: Move = { type: 'move', direction: 'down' };
const up: Move = { type: 'move', direction: 'up' };

function play(moves: readonly Move[], frames: readonly number[]): Simulation {
  let sim = moves.reduce<Simulation>(
    (acc, move) => queueMove(acc, move),
    createSimulation(level, { stepMs: STEP }),
  );
  for (const dt of frames) sim = advanceSimulation(sim, dt).simulation;
  return sim;
}

describe('fixed-timestep simulation', () => {
  /**
   * The criterion: the same inputs always produce the same state. Frame pacing
   * is the thing most likely to break that, so it is what the test varies.
   */
  it('produces the same state from the same inputs at any frame pacing', () => {
    const moves = [right, right, right, { type: 'pickup' } as Move, down, down];

    const steady = play(moves, Array.from({ length: 20 }, () => STEP));
    const stuttering = play(moves, [STEP * 3, 1, 1, STEP * 2, STEP, 0.5, STEP * 4, STEP * 2]);
    const oneBigFrame = play(moves, [STEP * 6]);

    expect(encodeState(stuttering.state)).toBe(encodeState(steady.state));
    expect(encodeState(oneBigFrame.state)).toBe(encodeState(steady.state));
    expect(stuttering.state.player).toEqual(steady.state.player);
  });

  it('applies at most one queued move per fixed step', () => {
    let sim = [right, right, right].reduce<Simulation>(
      (acc, move) => queueMove(acc, move),
      createSimulation(level, { stepMs: STEP }),
    );

    const first = advanceSimulation(sim, STEP);
    expect(first.applied).toHaveLength(1);
    expect(first.simulation.pending).toHaveLength(2);
    expect(first.simulation.state.player).toEqual({ x: 2, y: 1 });

    sim = advanceSimulation(first.simulation, STEP * 2).simulation;
    expect(sim.pending).toHaveLength(0);
    expect(sim.state.player).toEqual({ x: 4, y: 1 });
  });

  it('does not advance the world when no time has passed', () => {
    const sim = queueMove(createSimulation(level, { stepMs: STEP }), right);
    const outcome = advanceSimulation(sim, 0);
    expect(outcome.applied).toEqual([]);
    expect(outcome.simulation.state.player).toEqual(level.player);
  });

  it('counts a refused move without changing the world', () => {
    const sim = queueMove(createSimulation(level, { stepMs: STEP }), up);
    const outcome = advanceSimulation(sim, STEP);
    expect(outcome.rejected).toEqual([up]);
    expect(outcome.simulation.refused).toBe(1);
    expect(outcome.simulation.state.player).toEqual(level.player);
  });

  it('reports reaching the goal exactly once and then stops accepting moves', () => {
    // criticalPath is stored as action tokens (F-03); parseAction is the
    // inverse of describeMove.
    const solution = level.criticalPath.map(parseAction);
    expect(solution.length).toBeGreaterThan(0);

    let sim = solution.reduce<Simulation>(
      (acc, move) => queueMove(acc, move),
      createSimulation(level, { stepMs: STEP }),
    );

    let goals = 0;
    for (let i = 0; i < solution.length + 4; i += 1) {
      const outcome = advanceSimulation(sim, STEP);
      if (outcome.reachedGoal) goals += 1;
      sim = outcome.simulation;
    }

    expect(goals).toBe(1);
    expect(sim.finished).toBe(true);
    expect(queueMove(sim, right).pending).toHaveLength(0);
  });

  it('measures elapsed time in ticks, so it cannot drift with frame rate', () => {
    const sim = play([], [STEP, STEP, STEP / 2, STEP / 2]);
    expect(simulationElapsedMs(sim)).toBe(STEP * 3);
  });
});
