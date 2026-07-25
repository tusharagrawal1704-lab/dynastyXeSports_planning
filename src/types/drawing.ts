export type DrawTool = 'freedraw' | 'line' | 'arrow' | 'circle' | 'rectangle' | 'polygon' | 'erase' | 'none';
export type SpecialTool = 'none' | 'flight' | 'vehicle-path' | 'zone';

export type DrawShape = 'freedraw' | 'line' | 'arrow' | 'circle' | 'rectangle' | 'polygon';

export interface DrawingItem {
  id: string;
  shape: DrawShape;
  points: number[];
  color: string;
  strokeWidth: number;
  opacity: number;
  closed?: boolean;
  createdAt: number;
}

export interface SafeZone {
  id: string;
  circle: 1 | 2 | 3 | 4 | 5 | 6;
  x: number;
  y: number;
  radius: number;
}

export interface FlightPath {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface VehiclePath {
  id: string;
  points: number[];
}
