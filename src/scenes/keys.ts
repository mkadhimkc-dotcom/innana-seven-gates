/** Scene keys, so scene transitions never depend on stringly-typed literals. */
export const SceneKey = {
  Boot: 'boot',
  Menu: 'menu',
  Level: 'level',
} as const;

export type SceneKey = (typeof SceneKey)[keyof typeof SceneKey];
