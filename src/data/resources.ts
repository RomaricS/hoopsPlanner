export const RES_IDS = ['food', 'water', 'wood', 'stone', 'iron', 'gold'] as const;
export type ResId = (typeof RES_IDS)[number];
export type ResBag = Partial<Record<ResId, number>>;

export interface ResourceDef {
  id: ResId;
  name: string;
  /** Era in which the resource first appears in the HUD. */
  era: number;
  color: string;
}

export const RESOURCES: Record<ResId, ResourceDef> = {
  food: { id: 'food', name: 'Food', era: 1, color: '#e8a33d' },
  water: { id: 'water', name: 'Water', era: 1, color: '#4fb3e8' },
  wood: { id: 'wood', name: 'Wood', era: 1, color: '#b07a45' },
  stone: { id: 'stone', name: 'Stone', era: 1, color: '#a9a49b' },
  iron: { id: 'iron', name: 'Iron', era: 2, color: '#8d99a6' },
  gold: { id: 'gold', name: 'Gold', era: 3, color: '#f2c94c' },
};
