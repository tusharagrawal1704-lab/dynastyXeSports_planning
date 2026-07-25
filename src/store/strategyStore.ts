import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { TacticalMarker, MarkerType } from '@/types/marker';
import type { PlayerSlot, PlayerRole } from '@/types/player';
import type { DrawingItem, SafeZone, FlightPath, VehiclePath, DrawShape, DrawTool, SpecialTool } from '@/types/drawing';
import type { HistoryEntry, ActionType } from '@/types/strategy';
import { MARKER_DEFINITIONS, getMarkerDefinition } from '@/types/marker';
import { PLAYER_COLORS, DEFAULT_PLAYER_NAMES, DEFAULT_PLAYER_ROLES } from '@/types/player';

export type ToolMode = 'select' | 'marker' | 'draw' | 'player' | 'special';

interface StrategyStore {
  // Data
  markers: TacticalMarker[];
  players: PlayerSlot[];
  drawings: DrawingItem[];
  safeZones: SafeZone[];
  flightPaths: FlightPath[];
  vehiclePaths: VehiclePath[];
  notes: string;
  history: HistoryEntry[];

  // UI state
  activeTool: DrawTool;
  activeSpecialTool: SpecialTool;
  activeMarkerType: MarkerType | null;
  toolMode: ToolMode;
  selectedMarkerId: string | null;
  selectedDrawingId: string | null;
  selectedPlayerId: string | null;
  drawColor: string;
  brushSize: number;
  opacity: number;
  isPanMode: boolean;

  // Flight path / vehicle path temp state
  flightStart: { x: number; y: number } | null;
  vehiclePathPoints: number[];

  // Actions
  setToolMode: (mode: ToolMode) => void;
  setActiveTool: (tool: DrawTool) => void;
  setActiveSpecialTool: (tool: SpecialTool) => void;
  setActiveMarkerType: (type: MarkerType | null) => void;
  setSelectedMarker: (id: string | null) => void;
  setSelectedDrawing: (id: string | null) => void;
  setSelectedPlayer: (id: string | null) => void;
  setDrawColor: (color: string) => void;
  setBrushSize: (size: number) => void;
  setOpacity: (opacity: number) => void;
  setPanMode: (pan: boolean) => void;
  setNotes: (notes: string) => void;

  // Markers
  addMarker: (type: MarkerType, x: number, y: number) => void;
  updateMarker: (id: string, patch: Partial<TacticalMarker>) => void;
  moveMarker: (id: string, x: number, y: number) => void;
  deleteMarker: (id: string) => void;

  // Drawings
  addDrawing: (drawing: Omit<DrawingItem, 'id' | 'createdAt'>) => string;
  deleteDrawing: (id: string) => void;
  clearDrawings: () => void;

  // Players
  addPlayer: (slot: 1 | 2 | 3 | 4 | 5) => void;
  movePlayer: (id: string, x: number, y: number) => void;
  updatePlayer: (id: string, patch: Partial<Pick<PlayerSlot, 'name' | 'role'>>) => void;
  removePlayer: (id: string) => void;

  // Safe zones
  addSafeZone: (circle: 1 | 2 | 3 | 4 | 5 | 6) => void;
  updateSafeZone: (id: string, patch: Partial<SafeZone>) => void;
  removeSafeZone: (id: string) => void;

  // Flight path
  setFlightStart: (pos: { x: number; y: number } | null) => void;
  addFlightPath: (startX: number, startY: number, endX: number, endY: number) => void;
  removeFlightPath: (id: string) => void;

  // Vehicle path
  addVehiclePathPoint: (x: number, y: number) => void;
  finishVehiclePath: () => void;
  removeVehiclePath: (id: string) => void;

  // History
  pushHistory: (action: ActionType, description: string) => void;
  clearHistory: () => void;

  // Bulk
  clearAll: () => void;
  loadStrategy: (data: Partial<StrategyStore>) => void;
  getStrategyJSON: () => string;
}

function defaultPlayers(): PlayerSlot[] {
  return [1, 2, 3, 4, 5].map((slot) => ({
    id: uuidv4(),
    slot: slot as 1 | 2 | 3 | 4 | 5,
    name: DEFAULT_PLAYER_NAMES[slot - 1],
    role: (DEFAULT_PLAYER_ROLES as PlayerRole[])[slot - 1],
    x: 250 + (slot - 1) * 110,
    y: 400,
    color: PLAYER_COLORS[slot - 1],
  }));
}

export const useStrategyStore = create<StrategyStore>((set, get) => ({
  markers: [],
  players: defaultPlayers(),
  drawings: [],
  safeZones: [],
  flightPaths: [],
  vehiclePaths: [],
  notes: '',
  history: [],

  activeTool: 'none',
  activeSpecialTool: 'none',
  activeMarkerType: null,
  toolMode: 'select',
  selectedMarkerId: null,
  selectedDrawingId: null,
  selectedPlayerId: null,
  drawColor: '#38bdf8',
  brushSize: 3,
  opacity: 0.8,
  isPanMode: false,

  flightStart: null,
  vehiclePathPoints: [],

  setToolMode: (mode) => set({ toolMode: mode, activeTool: mode === 'draw' ? get().activeTool : 'none', activeMarkerType: mode === 'marker' ? get().activeMarkerType : null, activeSpecialTool: mode === 'special' ? get().activeSpecialTool : 'none' }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setActiveSpecialTool: (tool) => set({ activeSpecialTool: tool }),
  setActiveMarkerType: (type) => set({ activeMarkerType: type }),
  setSelectedMarker: (id) => set({ selectedMarkerId: id, selectedDrawingId: null, selectedPlayerId: null }),
  setSelectedDrawing: (id) => set({ selectedDrawingId: id, selectedMarkerId: null, selectedPlayerId: null }),
  setSelectedPlayer: (id) => set({ selectedPlayerId: id, selectedMarkerId: null, selectedDrawingId: null }),
  setDrawColor: (color) => set({ drawColor: color }),
  setBrushSize: (size) => set({ brushSize: size }),
  setOpacity: (opacity) => set({ opacity }),
  setPanMode: (pan) => set({ isPanMode: pan }),
  setNotes: (notes) => set({ notes }),

  addMarker: (type, x, y) => {
    const def = getMarkerDefinition(type);
    const marker: TacticalMarker = {
      id: uuidv4(),
      type,
      x,
      y,
      label: def.label,
      notes: '',
      color: def.color,
      icon: def.icon,
      createdAt: Date.now(),
    };
    set((s) => ({ markers: [...s.markers, marker] }));
    get().pushHistory('add', `Added ${def.label} marker`);
  },

  updateMarker: (id, patch) =>
    set((s) => ({ markers: s.markers.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),

  moveMarker: (id, x, y) =>
    set((s) => ({ markers: s.markers.map((m) => (m.id === id ? { ...m, x, y } : m)) })),

  deleteMarker: (id) => {
    const marker = get().markers.find((m) => m.id === id);
    set((s) => ({ markers: s.markers.filter((m) => m.id !== id), selectedMarkerId: null }));
    if (marker) get().pushHistory('delete', `Deleted ${marker.label} marker`);
  },

  addDrawing: (drawing) => {
    const id = uuidv4();
    const item: DrawingItem = { ...drawing, id, createdAt: Date.now() };
    set((s) => ({ drawings: [...s.drawings, item] }));
    return id;
  },

  deleteDrawing: (id) =>
    set((s) => ({ drawings: s.drawings.filter((d) => d.id !== id), selectedDrawingId: null })),

  clearDrawings: () => set((s) => ({ drawings: [] })),

  addPlayer: (slot) => {
    const existing = get().players.find((p) => p.slot === slot);
    if (existing) return;
    const player: PlayerSlot = {
      id: uuidv4(),
      slot,
      name: DEFAULT_PLAYER_NAMES[slot - 1] || `Player ${slot}`,
      role: (DEFAULT_PLAYER_ROLES as PlayerRole[])[slot - 1] || 'Assaulter',
      x: 250 + (slot - 1) * 110,
      y: 400,
      color: PLAYER_COLORS[slot - 1] || '#38bdf8',
    };
    set((s) => ({ players: [...s.players, player] }));
  },

  movePlayer: (id, x, y) =>
    set((s) => ({ players: s.players.map((p) => (p.id === id ? { ...p, x, y } : p)) })),

  updatePlayer: (id, patch) =>
    set((s) => ({ players: s.players.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),

  removePlayer: (id) =>
    set((s) => ({ players: s.players.filter((p) => p.id !== id), selectedPlayerId: null })),

  addSafeZone: (circle) => {
    const zone: SafeZone = { id: uuidv4(), circle, x: 500, y: 500, radius: 150 + circle * 30 };
    set((s) => ({ safeZones: [...s.safeZones, zone] }));
    get().pushHistory('add', `Added Safe Zone Circle ${circle}`);
  },

  updateSafeZone: (id, patch) =>
    set((s) => ({ safeZones: s.safeZones.map((z) => (z.id === id ? { ...z, ...patch } : z)) })),

  removeSafeZone: (id) =>
    set((s) => ({ safeZones: s.safeZones.filter((z) => z.id !== id) })),

  setFlightStart: (pos) => set({ flightStart: pos }),

  addFlightPath: (startX, startY, endX, endY) => {
    const path: FlightPath = { id: uuidv4(), startX, startY, endX, endY };
    set((s) => ({ flightPaths: [...s.flightPaths, path], flightStart: null }));
    get().pushHistory('add', 'Added flight path');
  },

  removeFlightPath: (id) =>
    set((s) => ({ flightPaths: s.flightPaths.filter((f) => f.id !== id) })),

  addVehiclePathPoint: (x, y) =>
    set((s) => ({ vehiclePathPoints: [...s.vehiclePathPoints, x, y] })),

  finishVehiclePath: () => {
    const pts = get().vehiclePathPoints;
    if (pts.length >= 4) {
      const path: VehiclePath = { id: uuidv4(), points: [...pts] };
      set((s) => ({ vehiclePaths: [...s.vehiclePaths, path], vehiclePathPoints: [] }));
      get().pushHistory('add', 'Added vehicle path');
    } else {
      set({ vehiclePathPoints: [] });
    }
  },

  removeVehiclePath: (id) =>
    set((s) => ({ vehiclePaths: s.vehiclePaths.filter((v) => v.id !== id) })),

  pushHistory: (action, description) =>
    set((s) => ({
      history: [{ id: uuidv4(), action, description, timestamp: Date.now() }, ...s.history].slice(0, 50),
    })),

  clearHistory: () => set({ history: [] }),

  clearAll: () =>
    set({
      markers: [],
      drawings: [],
      safeZones: [],
      flightPaths: [],
      vehiclePaths: [],
      selectedMarkerId: null,
      selectedDrawingId: null,
      vehiclePathPoints: [],
      flightStart: null,
    }),

  loadStrategy: (data) =>
    set({
      markers: data.markers ?? [],
      players: data.players ?? defaultPlayers(),
      drawings: data.drawings ?? [],
      safeZones: data.safeZones ?? [],
      flightPaths: data.flightPaths ?? [],
      vehiclePaths: data.vehiclePaths ?? [],
      notes: data.notes ?? '',
      selectedMarkerId: null,
      selectedDrawingId: null,
      selectedPlayerId: null,
    }),

  getStrategyJSON: () => {
    const s = get();
    return JSON.stringify({
      markers: s.markers,
      players: s.players,
      drawings: s.drawings,
      safeZones: s.safeZones,
      flightPaths: s.flightPaths,
      vehiclePaths: s.vehiclePaths,
      notes: s.notes,
    }, null, 2);
  },
}));

export { MARKER_DEFINITIONS };
