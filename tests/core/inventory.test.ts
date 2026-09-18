import { describe, expect, it } from 'vitest';
import { INVENTORY_LIMIT, addItem, isCarrying, isFull, removeItem } from '../../src/core/inventory.js';

describe('inventory (SPEC 12)', () => {
  it('carries up to three items', () => {
    expect(INVENTORY_LIMIT).toBe(3);
    let carrying: readonly string[] = [];
    for (const id of ['a', 'b', 'c']) {
      const result = addItem(carrying, id);
      expect(result.displaced).toBeNull();
      carrying = result.carrying;
    }
    expect(carrying).toEqual(['a', 'b', 'c']);
    expect(isFull(carrying)).toBe(true);
  });

  it('drops the oldest item when a fourth is picked up', () => {
    const result = addItem(['a', 'b', 'c'], 'd');
    expect(result.displaced).toBe('a');
    expect(result.carrying).toEqual(['b', 'c', 'd']);
  });

  it('is a no-op when the item is already carried', () => {
    const result = addItem(['a', 'b'], 'b');
    expect(result.displaced).toBeNull();
    expect(result.carrying).toEqual(['a', 'b']);
  });

  it('removes a named item and leaves the rest in order', () => {
    expect(removeItem(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
    expect(isCarrying(removeItem(['a'], 'a'), 'a')).toBe(false);
  });
});
