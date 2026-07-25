export type PlayerRole = 'IGL' | 'Assaulter' | 'Support' | 'Sniper' | 'Entry Fragger';

export const PLAYER_ROLES: PlayerRole[] = ['IGL', 'Assaulter', 'Support', 'Sniper', 'Entry Fragger'];

export interface PlayerSlot {
  id: string;
  slot: 1 | 2 | 3 | 4 | 5;
  name: string;
  role: PlayerRole;
  x: number;
  y: number;
  color: string;
}

export const PLAYER_COLORS = ['#38bdf8', '#f97316', '#a855f7', '#22c55e', '#ec4899'];
export const DEFAULT_PLAYER_NAMES = ['DXxTushar1704M', 'DXxMystic', 'DXxJester', 'DXxVillian', 'DXxDeep'];
export const DEFAULT_PLAYER_ROLES: PlayerRole[] = ['IGL', 'Assaulter', 'Assaulter', 'Assaulter', 'Assaulter'];
