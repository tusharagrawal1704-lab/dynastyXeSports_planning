export type MarkerType =
  | 'attack'
  | 'rotate'
  | 'enemy'
  | 'loot'
  | 'vehicle'
  | 'sniper'
  | 'danger'
  | 'camp'
  | 'smoke'
  | 'grenade'
  | 'scout'
  | 'airdrop'
  | 'drop';

export interface MarkerDefinition {
  type: MarkerType;
  label: string;
  color: string;
  icon: string;
}

export interface TacticalMarker {
  id: string;
  type: MarkerType;
  x: number;
  y: number;
  label: string;
  notes: string;
  color: string;
  icon: string;
  createdAt: number;
}

export const MARKER_DEFINITIONS: MarkerDefinition[] = [
  { type: 'attack', label: 'Attack', color: '#ef4444', icon: 'swords' },
  { type: 'rotate', label: 'Rotate', color: '#a855f7', icon: 'rotate' },
  { type: 'enemy', label: 'Enemy', color: '#dc2626', icon: 'skull' },
  { type: 'loot', label: 'Loot', color: '#22c55e', icon: 'package' },
  { type: 'vehicle', label: 'Vehicle', color: '#3b82f6', icon: 'car' },
  { type: 'sniper', label: 'Sniper', color: '#64748b', icon: 'crosshair' },
  { type: 'danger', label: 'Danger', color: '#f97316', icon: 'alert' },
  { type: 'camp', label: 'Camp', color: '#84cc16', icon: 'tent' },
  { type: 'smoke', label: 'Smoke', color: '#94a3b8', icon: 'cloud' },
  { type: 'grenade', label: 'Grenade', color: '#eab308', icon: 'grenade' },
  { type: 'scout', label: 'Scout', color: '#06b6d4', icon: 'eye' },
  { type: 'airdrop', label: 'Air Drop', color: '#facc15', icon: 'plane' },
  { type: 'drop', label: 'Drop Location', color: '#ec4899', icon: 'map-pin' },
];

export function getMarkerDefinition(type: MarkerType): MarkerDefinition {
  return MARKER_DEFINITIONS.find((m) => m.type === type) ?? MARKER_DEFINITIONS[0];
}
