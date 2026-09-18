/** Inventory rules (SPEC 12): carry up to 3 items, a 4th drops the oldest. */

export const INVENTORY_LIMIT = 3;

export interface AddResult {
  /** Carried ids after the pickup, oldest first. */
  readonly carrying: readonly string[];
  /** The item bumped out of the inventory, or null if there was room. */
  readonly displaced: string | null;
}

export function isFull(carrying: readonly string[]): boolean {
  return carrying.length >= INVENTORY_LIMIT;
}

export function isCarrying(carrying: readonly string[], itemId: string): boolean {
  return carrying.includes(itemId);
}

/**
 * Add an item. When the inventory is already full the oldest item is
 * displaced; the caller decides where it lands (SPEC 12 puts it at the
 * player's feet).
 */
export function addItem(carrying: readonly string[], itemId: string): AddResult {
  if (isCarrying(carrying, itemId)) {
    return { carrying, displaced: null };
  }
  if (!isFull(carrying)) {
    return { carrying: [...carrying, itemId], displaced: null };
  }
  const [oldest, ...rest] = carrying;
  return { carrying: [...rest, itemId], displaced: oldest ?? null };
}

export function removeItem(carrying: readonly string[], itemId: string): readonly string[] {
  return carrying.filter((id) => id !== itemId);
}
