import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  MapPin,
  Search,
  Ruler,
  Grid,
  ZoomIn,
  ZoomOut,
  Crosshair,
  Compass,
  Tag,
  Users,
  Shield,
  Plane,
  Car,
  CircleDot
} from 'lucide-react';
import { useStrategyStore } from '@/store/strategyStore';
import { MARKER_DEFINITIONS, getMarkerDefinition, type MarkerType } from '@/types/marker';
import type { DrawShape } from '@/types/drawing';

interface POI {
  name: string;
  category: 'Major City' | 'Military' | 'Loot Hotspot' | 'Landmark';
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
}

const MAP_POIS: Record<string, POI[]> = {
  erangel: [
    { name: 'Pochinki', category: 'Major City', x: 45, y: 48 },
    { name: 'School & Apartments', category: 'Loot Hotspot', x: 56, y: 40 },
    { name: 'Sosnovka Military Base', category: 'Military', x: 52, y: 84 },
    { name: 'Georgopol Containers', category: 'Loot Hotspot', x: 24, y: 28 },
    { name: 'Rozhok', category: 'Major City', x: 48, y: 32 },
    { name: 'Yasnaya Polyana', category: 'Major City', x: 70, y: 30 },
    { name: 'Mylta Power', category: 'Loot Hotspot', x: 82, y: 55 },
    { name: 'Novorepnoye', category: 'Loot Hotspot', x: 67, y: 84 },
    { name: 'Hospital', category: 'Landmark', x: 18, y: 36 },
    { name: 'Stalber', category: 'Landmark', x: 78, y: 15 },
  ],
  miramar: [
    { name: 'Pecado', category: 'Loot Hotspot', x: 48, y: 50 },
    { name: 'Los Leones', category: 'Major City', x: 72, y: 68 },
    { name: 'El Pozo', category: 'Major City', x: 25, y: 35 },
    { name: 'Hacienda del Patrón', category: 'Loot Hotspot', x: 56, y: 38 },
    { name: 'San Martin', category: 'Major City', x: 46, y: 38 },
    { name: 'Campo Militar', category: 'Military', x: 85, y: 15 },
    { name: 'Chumacera', category: 'Landmark', x: 38, y: 65 },
  ],
  rondo: [
    { name: 'Jadhavpur / Meyran', category: 'Major City', x: 50, y: 50 },
    { name: 'Bamboo Forest', category: 'Landmark', x: 25, y: 30 },
    { name: 'Yu Lin', category: 'Loot Hotspot', x: 75, y: 32 },
    { name: 'Grand Arena', category: 'Military', x: 40, y: 70 },
  ],
};

interface MeasurePoint {
  x: number;
  y: number;
}

interface GoogleMapViewerProps {
  mapId: string;
  mapName: string;
  mapSrc: string;
  onExportRef?: (fn: (() => void) | null) => void;
}

export function GoogleMapViewer({ mapId, mapName, mapSrc, onExportRef }: GoogleMapViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapImageRef = useRef<HTMLImageElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const [showGrid, setShowGrid] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activePOI, setActivePOI] = useState<POI | null>(null);

  // Ruler measurement state
  const [isMeasureMode, setIsMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<MeasurePoint[]>([]);

  // Drawing state in viewer
  const [currentPoints, setCurrentPoints] = useState<number[]>([]);
  const isDrawingRef = useRef(false);

  // Dragging Player/Marker state
  const [draggingPlayerId, setDraggingPlayerId] = useState<string | null>(null);
  const [draggingMarkerId, setDraggingMarkerId] = useState<string | null>(null);

  // Strategy Store State
  const store = useStrategyStore();
  const {
    markers, players, drawings, safeZones, flightPaths, vehiclePaths,
    toolMode, activeTool, activeMarkerType, activeSpecialTool,
    selectedMarkerId, selectedDrawingId, selectedPlayerId,
    drawColor, brushSize, opacity,
    flightStart, vehiclePathPoints,
    addMarker, moveMarker, deleteMarker, setSelectedMarker,
    addDrawing, deleteDrawing, setSelectedDrawing,
    movePlayer, setSelectedPlayer,
    addSafeZone, setFlightStart, addFlightPath,
    addVehiclePathPoint, finishVehiclePath,
  } = store;

  const pois = useMemo(() => MAP_POIS[mapId.toLowerCase()] || MAP_POIS.erangel, [mapId]);

  const filteredPOIs = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return pois.filter((poi) => poi.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery, pois]);

  // Export support
  useEffect(() => {
    if (onExportRef) {
      onExportRef(() => {
        const link = document.createElement('a');
        link.download = `dynastyx-${mapId}-strategy-${Date.now()}.png`;
        link.href = mapSrc;
        link.click();
      });
    }
    return () => { onExportRef?.(null); };
  }, [onExportRef, mapSrc, mapId]);

  // Handle Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setZoom((prev) => Math.max(0.8, Math.min(5, prev + delta)));
  };

  // Convert client click to 0-1000 map coordinates
  const getMapCoordinates = (e: React.MouseEvent): { x: number; y: number } | null => {
    if (!mapImageRef.current) return null;
    const rect = mapImageRef.current.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;

    const mapX = Math.round(clickX * 1000);
    const mapY = Math.round(clickY * 1000);
    return { x: Math.max(0, Math.min(1000, mapX)), y: Math.max(0, Math.min(1000, mapY)) };
  };

  // Handle Mouse Down
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;

    // Dragging player or marker
    if (draggingPlayerId || draggingMarkerId) return;

    const mapPos = getMapCoordinates(e);

    // Pan Mode or Select Mode
    if (toolMode === 'select' || e.shiftKey) {
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      return;
    }

    if (!mapPos) return;

    // Marker Mode
    if (toolMode === 'marker' && activeMarkerType) {
      addMarker(activeMarkerType, mapPos.x, mapPos.y);
      return;
    }

    // Special Mode
    if (toolMode === 'special') {
      if (activeSpecialTool === 'flight') {
        if (!flightStart) {
          setFlightStart(mapPos);
        } else {
          addFlightPath(flightStart.x, flightStart.y, mapPos.x, mapPos.y);
        }
        return;
      }
      if (activeSpecialTool === 'vehicle-path') {
        addVehiclePathPoint(mapPos.x, mapPos.y);
        return;
      }
      if (activeSpecialTool === 'zone') {
        addSafeZone((safeZones.length + 1) as any);
        return;
      }
    }

    // Measure Mode
    if (isMeasureMode) {
      setMeasurePoints((prev) => [...prev, mapPos]);
      return;
    }

    // Drawing Mode
    if (toolMode === 'draw' && activeTool !== 'none' && activeTool !== 'erase') {
      isDrawingRef.current = true;
      if (activeTool === 'freedraw') {
        setCurrentPoints([mapPos.x, mapPos.y]);
      } else {
        setCurrentPoints([mapPos.x, mapPos.y, mapPos.x, mapPos.y]);
      }
    }
  };

  // Handle Mouse Move
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy });
      return;
    }

    const mapPos = getMapCoordinates(e);
    if (!mapPos) return;

    // Dragging Player
    if (draggingPlayerId) {
      movePlayer(draggingPlayerId, mapPos.x, mapPos.y);
      return;
    }

    // Dragging Marker
    if (draggingMarkerId) {
      moveMarker(draggingMarkerId, mapPos.x, mapPos.y);
      return;
    }

    // Drawing
    if (isDrawingRef.current) {
      if (activeTool === 'freedraw') {
        setCurrentPoints((prev) => [...prev, mapPos.x, mapPos.y]);
      } else if (activeTool !== 'polygon') {
        setCurrentPoints((prev) => {
          const pts = [...prev];
          pts[2] = mapPos.x;
          pts[3] = mapPos.y;
          return pts;
        });
      }
    }
  };

  // Handle Mouse Up
  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
    }
    if (draggingPlayerId) {
      setDraggingPlayerId(null);
    }
    if (draggingMarkerId) {
      setDraggingMarkerId(null);
    }
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      if (currentPoints.length >= 4 && activeTool !== 'polygon') {
        addDrawing({
          shape: activeTool as DrawShape,
          points: currentPoints,
          color: drawColor,
          strokeWidth: brushSize,
          opacity,
        });
      }
      setCurrentPoints([]);
    }
  };

  // Focus POI
  const jumpToPOI = (poi: POI) => {
    setActivePOI(poi);
    setZoom(2.2);
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      const targetX = width / 2 - (poi.x / 100) * width * 2.2;
      const targetY = height / 2 - (poi.y / 100) * height * 2.2;
      setPan({ x: targetX, y: targetY });
    }
    setSearchQuery('');
  };

  // Reset Map View
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setActivePOI(null);
  };

  // Calculate distance in meters
  const totalDistanceMeters = useMemo(() => {
    if (measurePoints.length < 2) return 0;
    let dist = 0;
    for (let i = 1; i < measurePoints.length; i++) {
      const p1 = measurePoints[i - 1];
      const p2 = measurePoints[i];
      const dx = ((p2.x - p1.x) / 1000) * 8000;
      const dy = ((p2.y - p1.y) / 1000) * 8000;
      dist += Math.sqrt(dx * dx + dy * dy);
    }
    return Math.round(dist);
  }, [measurePoints]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950 select-none shadow-2xl"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={() => {
        if (toolMode === 'special' && activeSpecialTool === 'vehicle-path') {
          finishVehiclePath();
        }
      }}
    >
      {/* Search Bar Overlay */}
      <div className="absolute top-4 left-4 z-30 w-80">
        <div className="relative glass rounded-xl shadow-lg backdrop-blur-md">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-primary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${mapName} location (e.g. Pochinki)...`}
            className="w-full bg-transparent py-2.5 pl-10 pr-4 text-xs font-medium text-white placeholder-muted-foreground focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-xs text-muted-foreground hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        {/* POI Autocomplete Results */}
        <AnimatePresence>
          {filteredPOIs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-1 glass overflow-hidden rounded-xl border border-white/10 p-1 shadow-xl backdrop-blur-xl"
            >
              {filteredPOIs.map((poi) => (
                <button
                  key={poi.name}
                  onClick={() => jumpToPOI(poi)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-all hover:bg-primary/20 hover:text-primary"
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-neon" />
                    <span className="font-semibold text-white">{poi.name}</span>
                  </div>
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {poi.category}
                  </span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mode Controls Bar */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-2 glass rounded-xl p-1.5 shadow-lg">
        <button
          onClick={() => {
            setIsMeasureMode(!isMeasureMode);
            if (isMeasureMode) setMeasurePoints([]);
          }}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
            isMeasureMode ? 'bg-amber-500 text-black font-bold' : 'hover:bg-white/10 text-white'
          }`}
        >
          <Ruler className="h-3.5 w-3.5" />
          <span>{isMeasureMode ? `Ruler (${totalDistanceMeters}m)` : 'Measure'}</span>
        </button>

        <button
          onClick={() => setShowGrid(!showGrid)}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-all ${
            showGrid ? 'bg-white/20 text-white' : 'text-muted-foreground hover:bg-white/10'
          }`}
          title="Toggle Grid (A1-J10)"
        >
          <Grid className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Interactive Map Transform Layer */}
      <div
        className="relative h-full w-full cursor-grab active:cursor-grabbing"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {/* WebP Map Image Base */}
        <img
          ref={mapImageRef}
          src={mapSrc}
          alt={mapName}
          className="h-full w-full object-cover select-none"
          draggable={false}
        />

        {/* Tactical Grid (A1-J10) */}
        {showGrid && (
          <div className="absolute inset-0 pointer-events-none grid grid-cols-10 grid-rows-10 border border-white/10">
            {Array.from({ length: 100 }).map((_, idx) => {
              const row = Math.floor(idx / 10) + 1;
              const col = String.fromCharCode(65 + (idx % 10));
              return (
                <div
                  key={idx}
                  className="relative border border-white/10 p-1 flex items-start justify-start"
                >
                  <span className="font-mono text-[9px] font-bold text-white/30 tracking-tighter">
                    {col}{row}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* SVG Drawing Layer */}
        <svg className="absolute inset-0 h-full w-full pointer-events-none z-10">
          {/* Saved Drawings */}
          {drawings.map((d) => {
            if (d.shape === 'freedraw' || d.shape === 'line') {
              const pointsStr = d.points.reduce((acc, curr, idx) => {
                if (idx % 2 === 0) return `${acc} ${(curr / 1000) * 100}%`;
                return `${acc},${(curr / 1000) * 100}%`;
              }, '').trim();
              return (
                <polyline
                  key={d.id}
                  points={pointsStr}
                  fill="none"
                  stroke={d.color}
                  strokeWidth={d.strokeWidth}
                  strokeOpacity={d.opacity}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            }
            if (d.shape === 'arrow' && d.points.length >= 4) {
              const x1 = `${(d.points[0] / 1000) * 100}%`;
              const y1 = `${(d.points[1] / 1000) * 100}%`;
              const x2 = `${(d.points[2] / 1000) * 100}%`;
              const y2 = `${(d.points[3] / 1000) * 100}%`;
              return (
                <g key={d.id}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={d.color}
                    strokeWidth={d.strokeWidth}
                    strokeOpacity={d.opacity}
                  />
                  <circle cx={x2} cy={y2} r={d.strokeWidth * 1.5} fill={d.color} />
                </g>
              );
            }
            if (d.shape === 'rectangle' && d.points.length >= 4) {
              const x1 = (d.points[0] / 1000) * 100;
              const y1 = (d.points[1] / 1000) * 100;
              const x2 = (d.points[2] / 1000) * 100;
              const y2 = (d.points[3] / 1000) * 100;
              return (
                <rect
                  key={d.id}
                  x={`${Math.min(x1, x2)}%`}
                  y={`${Math.min(y1, y2)}%`}
                  width={`${Math.abs(x2 - x1)}%`}
                  height={`${Math.abs(y2 - y1)}%`}
                  fill="none"
                  stroke={d.color}
                  strokeWidth={d.strokeWidth}
                  strokeOpacity={d.opacity}
                />
              );
            }
            if (d.shape === 'circle' && d.points.length >= 4) {
              const cx = (d.points[0] / 1000) * 100;
              const cy = (d.points[1] / 1000) * 100;
              const x2 = (d.points[2] / 1000) * 100;
              const y2 = (d.points[3] / 1000) * 100;
              const r = Math.sqrt((cx - x2) ** 2 + (cy - y2) ** 2);
              return (
                <ellipse
                  key={d.id}
                  cx={`${cx}%`}
                  cy={`${cy}%`}
                  rx={`${r}%`}
                  ry={`${r}%`}
                  fill="none"
                  stroke={d.color}
                  strokeWidth={d.strokeWidth}
                  strokeOpacity={d.opacity}
                />
              );
            }
            return null;
          })}

          {/* Current Active Drawing Temp Preview */}
          {currentPoints.length >= 4 && (
            <polyline
              points={currentPoints.reduce((acc, curr, idx) => {
                if (idx % 2 === 0) return `${acc} ${(curr / 1000) * 100}%`;
                return `${acc},${(curr / 1000) * 100}%`;
              }, '').trim()}
              fill="none"
              stroke={drawColor}
              strokeWidth={brushSize}
              strokeOpacity={opacity}
              strokeLinecap="round"
            />
          )}

          {/* Flight Paths */}
          {flightPaths.map((fp) => (
            <g key={fp.id}>
              <line
                x1={`${(fp.startX / 1000) * 100}%`}
                y1={`${(fp.startY / 1000) * 100}%`}
                x2={`${(fp.endX / 1000) * 100}%`}
                y2={`${(fp.endY / 1000) * 100}%`}
                stroke="#facc15"
                strokeWidth="4"
                strokeDasharray="8,6"
              />
              <circle cx={`${(fp.startX / 1000) * 100}%`} cy={`${(fp.startY / 1000) * 100}%`} r="6" fill="#facc15" />
              <circle cx={`${(fp.endX / 1000) * 100}%`} cy={`${(fp.endY / 1000) * 100}%`} r="8" fill="#facc15" />
            </g>
          ))}

          {/* Safe Zones */}
          {safeZones.map((z) => (
            <g key={z.id}>
              <ellipse
                cx={`${(z.x / 1000) * 100}%`}
                cy={`${(z.y / 1000) * 100}%`}
                rx={`${(z.radius / 1000) * 100}%`}
                ry={`${(z.radius / 1000) * 100}%`}
                fill="rgba(59,130,246,0.1)"
                stroke="#3b82f6"
                strokeWidth="3"
                strokeDasharray="6,4"
              />
            </g>
          ))}

          {/* Vehicle Paths */}
          {vehiclePaths.map((vp) => (
            <polyline
              key={vp.id}
              points={vp.points.reduce((acc, curr, idx) => {
                if (idx % 2 === 0) return `${acc} ${(curr / 1000) * 100}%`;
                return `${acc},${(curr / 1000) * 100}%`;
              }, '').trim()}
              fill="none"
              stroke="#f97316"
              strokeWidth="4"
              strokeDasharray="6,4"
            />
          ))}

          {/* Ruler Distance Lines */}
          {measurePoints.length > 0 && (
            <g>
              <polyline
                points={measurePoints.map((p) => `${(p.x / 1000) * 100}% ${(p.y / 1000) * 100}%`).join(', ')}
                fill="none"
                stroke="#fbbf24"
                strokeWidth="3"
                strokeDasharray="6,4"
              />
              {measurePoints.map((p, idx) => (
                <circle
                  key={idx}
                  cx={`${(p.x / 1000) * 100}%`}
                  cy={`${(p.y / 1000) * 100}%`}
                  r="5"
                  fill="#fbbf24"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              ))}
            </g>
          )}
        </svg>

        {/* POI Beacons */}
        {pois.map((poi) => (
          <div
            key={poi.name}
            onClick={(e) => {
              e.stopPropagation();
              jumpToPOI(poi);
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
            style={{ left: `${poi.x}%`, top: `${poi.y}%` }}
          >
            <div className="relative flex items-center justify-center">
              <span className="absolute h-6 w-6 rounded-full bg-primary/40 animate-ping" />
              <span className="h-3 w-3 rounded-full bg-primary ring-2 ring-white" />
              <div className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md glass px-2 py-0.5 text-[10px] font-bold text-white shadow-md opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all">
                {poi.name}
              </div>
            </div>
          </div>
        ))}

        {/* Active POI Highlight Effect */}
        {activePOI && (
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20"
            style={{ left: `${activePOI.x}%`, top: `${activePOI.y}%` }}
          >
            <div className="h-16 w-16 rounded-full border-2 border-neon flex items-center justify-center glow-neon">
              <Crosshair className="h-6 w-6 text-neon" />
            </div>
          </div>
        )}

        {/* Map Tactical Markers Layer */}
        {markers.map((marker) => {
          const def = getMarkerDefinition(marker.type);
          const isSelected = selectedMarkerId === marker.id;
          return (
            <div
              key={marker.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-30"
              style={{ left: `${(marker.x / 1000) * 100}%`, top: `${(marker.y / 1000) * 100}%` }}
              onMouseDown={(e) => {
                e.stopPropagation();
                setSelectedMarker(marker.id);
                setDraggingMarkerId(marker.id);
              }}
            >
              <div className="relative flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-white shadow-xl transition-transform ${
                    isSelected ? 'ring-4 ring-primary scale-110' : 'group-hover:scale-110'
                  }`}
                  style={{ backgroundColor: marker.color }}
                >
                  <MapPin className="h-4 w-4 text-white" />
                </div>
                <span className="mt-1 rounded glass px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                  {marker.label}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMarker(marker.id);
                  }}
                  className="absolute -top-2 -right-2 hidden h-4 w-4 rounded-full bg-red-600 text-[10px] text-white group-hover:flex items-center justify-center shadow"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}

        {/* Players Layer */}
        {players.map((player) => {
          const isSelected = selectedPlayerId === player.id;
          return (
            <div
              key={player.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-30"
              style={{ left: `${(player.x / 1000) * 100}%`, top: `${(player.y / 1000) * 100}%` }}
              onMouseDown={(e) => {
                e.stopPropagation();
                setSelectedPlayer(player.id);
                setDraggingPlayerId(player.id);
              }}
            >
              <div className="relative flex flex-col items-center">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-2xl transition-transform ${
                    isSelected ? 'ring-4 ring-white scale-125' : 'group-hover:scale-110'
                  }`}
                  style={{ backgroundColor: player.color, boxShadow: `0 0 16px ${player.color}` }}
                >
                  P{player.slot}
                </div>
                <span className="mt-1 rounded bg-black/80 px-2 py-0.5 text-[10px] font-bold text-white shadow border border-white/20 whitespace-nowrap">
                  {player.name} ({player.role})
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Bottom Control Tools */}
      <div className="absolute bottom-4 right-4 z-30 flex flex-col gap-2">
        <button
          onClick={() => setZoom((z) => Math.min(5, z + 0.25))}
          className="glass flex h-9 w-9 items-center justify-center rounded-lg text-white hover:bg-primary/20 hover:text-primary transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.8, z - 0.25))}
          className="glass flex h-9 w-9 items-center justify-center rounded-lg text-white hover:bg-primary/20 hover:text-primary transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          onClick={resetView}
          className="glass flex h-9 w-9 items-center justify-center rounded-lg text-white hover:bg-primary/20 hover:text-primary transition-colors"
          title="Reset Center"
        >
          <Compass className="h-4 w-4" />
        </button>
      </div>

      {/* Floating Mode Info Indicator Banner */}
      <div className="absolute bottom-4 left-4 z-30 flex items-center gap-3 glass rounded-xl px-3 py-1.5 text-xs text-muted-foreground">
        <span>Active Tool: <strong className="text-neon uppercase">{toolMode}</strong></span>
        <span>Map Scale: <strong className="text-white">{Math.round(zoom * 100)}%</strong></span>
        {totalDistanceMeters > 0 && (
          <span className="text-amber-400 font-bold">Ruler: {totalDistanceMeters}m</span>
        )}
      </div>
    </div>
  );
}
