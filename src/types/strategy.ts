import type { TacticalMarker } from './marker';
import type { PlayerSlot } from './player';
import type { DrawingItem, SafeZone, FlightPath, VehiclePath } from './drawing';

export interface StrategyState {
  markers: TacticalMarker[];
  players: PlayerSlot[];
  drawings: DrawingItem[];
  safeZones: SafeZone[];
  flightPaths: FlightPath[];
  vehiclePaths: VehiclePath[];
  notes: string;
  mapId: string;
  savedAt: number;
}

export type ActionType = 'add' | 'delete' | 'update' | 'move' | 'clear';

export interface HistoryEntry {
  id: string;
  action: ActionType;
  description: string;
  timestamp: number;
  undo?: () => void;
}
