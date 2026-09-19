import { describe, expect, it } from 'vitest';
import { createJourney, enterRoom, leaveRoom } from '../../src/core/rooms.js';
import { parseLevel } from '../../src/core/level.js';
import { applyMove } from '../../src/core/state.js';
import { computeLayout, pointToTile, tileCenter } from '../../src/ui/boardLayout.js';
import type { GameState, Move } from '../../src/core/types.js';
import gate0101 from '../../levels/gate-01/gate-01-01.json';
import collisionRoom from '../fixtures/collision-room.json';

// Two rooms of different sizes, so a transition is a real change of shape.
const roomOne = parseLevel(gate0101);
const roomTwo = parseLevel(collisionRoom);

const right: Move = { type: 'move', direction: 'right' };

describe('room transitions (SPEC 11)', () => {
  it('starts a fresh journey empty-handed', () => {
    const journey = createJourney();
    expect(journey.carrying).toEqual([]);
    expect(journey.cleared).toEqual([]);
    expect(enterRoom(roomOne, journey).ground['key-lapis']).toEqual({ x: 7, y: 1 });
  });

  it('carries inventory between rooms', () => {
    let state = enterRoom(roomOne, createJourney());
    for (let i = 0; i < 6; i += 1) state = applyMove(roomOne, state, right) as GameState;
    state = applyMove(roomOne, state, { type: 'pickup' }) as GameState;
    expect(state.carrying).toEqual(['key-lapis']);

    const journey = leaveRoom(roomOne, state, createJourney());
    expect(journey.carrying).toEqual(['key-lapis']);

    const nextRoom = enterRoom(roomTwo, journey);
    expect(nextRoom.carrying).toEqual(['key-lapis']);
    expect(nextRoom.player).toEqual(roomTwo.player);
  });

  it('does not re-spawn an item the room has already given up', () => {
    let state = enterRoom(roomOne, createJourney());
    for (let i = 0; i < 6; i += 1) state = applyMove(roomOne, state, right) as GameState;
    state = applyMove(roomOne, state, { type: 'pickup' }) as GameState;

    const journey = leaveRoom(roomOne, state, createJourney());
    expect(journey.taken['gate-01-01']).toEqual(['key-lapis']);

    // Coming back: the key is neither on the floor nor duplicated in hand.
    const returned = enterRoom(roomOne, journey);
    expect(returned.ground['key-lapis']).toBeUndefined();
    expect(returned.carrying).toEqual(['key-lapis']);
  });

  it('leaves an item still on the floor for next time', () => {
    const untouched = enterRoom(roomOne, createJourney());
    const journey = leaveRoom(roomOne, untouched, createJourney());
    expect(journey.taken['gate-01-01']).toEqual([]);
    expect(enterRoom(roomOne, journey).ground['key-lapis']).toEqual({ x: 7, y: 1 });
  });

  it('records each room cleared once, in order', () => {
    let journey = leaveRoom(roomOne, enterRoom(roomOne, createJourney()), createJourney());
    journey = leaveRoom(roomTwo, enterRoom(roomTwo, journey), journey);
    journey = leaveRoom(roomOne, enterRoom(roomOne, journey), journey);
    expect(journey.cleared).toEqual(['gate-01-01', 'fixture-collision']);
  });

  it('gives each room its own blocks and doors, not the previous room\'s', () => {
    const journey = leaveRoom(roomOne, enterRoom(roomOne, createJourney()), createJourney());
    const second = enterRoom(roomTwo, journey);
    expect(second.blocks).toHaveLength(roomTwo.blocks.length);
    expect(second.openDoors).toEqual([]);
  });
});

describe('camera across a room transition (SPEC 30)', () => {
  const viewport = { width: 960, height: 540 };

  it('re-fits to each room, keeping the whole room on screen', () => {
    for (const room of [roomOne, roomTwo]) {
      const layout = computeLayout(room, viewport);
      expect(layout.width).toBeLessThanOrEqual(viewport.width);
      expect(layout.height).toBeLessThanOrEqual(viewport.height);
      expect(layout.width).toBe(layout.tileSize * room.width);
      expect(layout.height).toBe(layout.tileSize * room.height);
    }
  });

  it('changes the fit when the next room is a different shape', () => {
    expect(roomTwo.width).not.toBe(roomOne.width);
    const first = computeLayout(roomOne, viewport);
    const second = computeLayout(roomTwo, viewport);
    expect(second.tileSize).not.toBe(first.tileSize);
  });

  it('keeps the player inside the drawn board in both rooms', () => {
    const journey = leaveRoom(roomOne, enterRoom(roomOne, createJourney()), createJourney());
    for (const [room, state] of [
      [roomOne, enterRoom(roomOne, createJourney())],
      [roomTwo, enterRoom(roomTwo, journey)],
    ] as const) {
      const layout = computeLayout(room, viewport);
      const centre = tileCenter(layout, state.player);
      expect(centre.x).toBeGreaterThanOrEqual(layout.originX);
      expect(centre.x).toBeLessThanOrEqual(layout.originX + layout.width);
      expect(pointToTile(layout, room, centre)).toEqual(state.player);
    }
  });
});
