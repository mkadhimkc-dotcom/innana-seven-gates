/** Scene keys, so scene transitions never depend on stringly-typed literals. */
export const SceneKey = {
  Boot: 'boot',
  Menu: 'menu',
  Level: 'level',
  /** v2 side-view scene (SPEC v2 §12), not yet reachable from the menu. */
  Platform: 'platform',
} as const;

export type SceneKey = (typeof SceneKey)[keyof typeof SceneKey];
