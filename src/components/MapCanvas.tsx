import { useRef, useState, useEffect, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Group, Line, Circle, Rect, Text, Arrow, Ellipse, Star } from 'react-konva';
import type Konva from 'konva';
import { useStrategyStore } from '@/store/strategyStore';
import { MARKER_DEFINITIONS, getMarkerDefinition, type MarkerType } from '@/types/marker';
import type { DrawShape } from '@/types/drawing';
import { cn } from '@/lib/utils';

interface MapCanvasProps {
  mapSrc: string;
  mapWidth?: number;
  mapHeight?: number;
  onExportRef?: (fn: (() => void) | null) => void;
}

const MAP_W = 1000;
const MAP_H = 1000;

const ICON_PATHS: Record<string, string> = {
  swords: 'M14.5 17.5L3 6V3h3l11.5 11.5 M13 19l6-6 3 3-6 6-3-3z M16 16l4-4 3 3-4 4-3-3z',
  rotate: 'M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.36 2.64L3 8 M3 3v5h5',
  skull: 'M12 2C7 2 3 6 3 11c0 3 2 5 4 6v3h2v-2h2v2h2v-2h2v2h2v-3c2-1 4-3 4-6 0-5-4-9-9-9z M9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0z M17 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0z',
  package: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.27 6.96 12 12.01l8.73-5.05 M12 22.08V12',
  car: 'M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2 M5 16a2 2 0 1 0 4 0 2 2 0 1 0-4 0z M15 16a2 2 0 1 0 4 0 2 2 0 1 0-4 0z',
  crosshair: 'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z M12 8v4 M12 12h4',
  alert: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01',
  tent: 'M3 20l9-16 9 16 M3 20h18 M12 4v16',
  cloud: 'M17.5 19a4.5 4.5 0 1 0 0-9 6 6 0 0 0-11.7 2A4 4 0 0 0 6 19h11.5z',
  grenade: 'M12 2v6 M9 5h6 M12 8a6 6 0 1 0 0 12 6 6 0 0 0 0-12z',
  eye: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z',
  plane: 'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z',
};

function MarkerShape({ type, color, size = 28 }: { type: MarkerType; color: string; size?: number }) {
  const def = getMarkerDefinition(type);
  const r = size / 2;
  return (
    <Group>
      <Circle radius={r} fill={color} stroke="white" strokeWidth={2} shadowColor={color} shadowBlur={8} />
      <Text text={def.label} x={-r} y={r + 2} width={size} align="center" fontSize={9} fill="white" fontStyle="bold" />
    </Group>
  );
}

export function MapCanvas({ mapSrc, onExportRef }: MapCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, sx: 0, sy: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Drawing temp state
  const [drawingPoints, setDrawingPoints] = useState<number[]>([]);
  const [polygonPoints, setPolygonPoints] = useState<number[]>([]);
  const isDrawing = useRef(false);

  const store = useStrategyStore();
  const {
    markers, players, drawings, safeZones, flightPaths, vehiclePaths,
    toolMode, activeTool, activeMarkerType, activeSpecialTool,
    selectedMarkerId, selectedDrawingId, selectedPlayerId,
    drawColor, brushSize, opacity, isPanMode,
    flightStart, vehiclePathPoints,
    addMarker, moveMarker, deleteMarker, updateMarker, setSelectedMarker,
    addDrawing, deleteDrawing, setSelectedDrawing,
    movePlayer, setSelectedPlayer, updatePlayer,
    addSafeZone, updateSafeZone, removeSafeZone,
    setFlightStart, addFlightPath,
    addVehiclePathPoint, finishVehiclePath,
    setPanMode, setToolMode, setActiveTool,
  } = store;

  // Load map image directly
  useEffect(() => {
    const img = new Image();
    img.onload = () => setImage(img);
    img.onerror = (err) => console.error('[MapCanvas] Error loading image:', mapSrc, err);
    img.src = mapSrc;
  }, [mapSrc]);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    let initialFit = false;
    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setStageSize({ width, height });
        if (!initialFit) {
          initialFit = true;
          const s = Math.min(width / MAP_W, height / MAP_H) * 0.95;
          setScale(s);
          setPosition({ x: (width - MAP_W * s) / 2, y: (height - MAP_H * s) / 2 });
        }
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const fitToScreen = useCallback((w?: number, h?: number) => {
    const cw = w ?? stageSize.width;
    const ch = h ?? stageSize.height;
    const s = Math.min(cw / MAP_W, ch / MAP_H) * 0.95;
    setScale(s);
    setPosition({ x: (cw - MAP_W * s) / 2, y: (ch - MAP_H * s) / 2 });
  }, [stageSize]);

  const resetView = useCallback(() => fitToScreen(), [fitToScreen]);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current?.parentElement;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // Export
  useEffect(() => {
    if (onExportRef) {
      onExportRef(() => {
        const stage = stageRef.current;
        if (!stage) return;
        const dataUrl = stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' });
        const link = document.createElement('a');
        link.download = `tactical-strategy-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
      });
    }
    return () => { onExportRef?.(null); };
  }, [onExportRef]);

  // Get pointer position in map coordinates
  const getMapPos = useCallback((): { x: number; y: number } | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    return {
      x: (pos.x - position.x) / scale,
      y: (pos.y - position.y) / scale,
    };
  }, [position, scale]);

  // Wheel zoom
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = scale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - position.x) / oldScale,
      y: (pointer.y - position.y) / oldScale,
    };

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const factor = 1.1;
    const newScale = direction > 0 ? oldScale * factor : oldScale / factor;
    const clamped = Math.max(0.1, Math.min(8, newScale));

    setScale(clamped);
    setPosition({
      x: pointer.x - mousePointTo.x * clamped,
      y: pointer.y - mousePointTo.y * clamped,
    });
  };

  // Mouse down
  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const isMiddle = e.evt.button === 1;
    const isLeft = e.evt.button === 0;

    if (isMiddle || isPanMode || (isLeft && toolMode === 'select' && e.target === e.currentTarget)) {
      setIsPanning(true);
      panStart.current = { x: e.evt.clientX, y: e.evt.clientY, sx: position.x, sy: position.y };
      return;
    }

    const mapPos = getMapPos();
    if (!mapPos) return;

    // Marker placement
    if (toolMode === 'marker' && activeMarkerType && isLeft) {
      addMarker(activeMarkerType, mapPos.x, mapPos.y);
      return;
    }

    // Special tools
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
        addSafeZone((safeZones.length + 1) as 1 | 2 | 3 | 4 | 5 | 6);
        return;
      }
    }

    // Drawing
    if (toolMode === 'draw' && activeTool !== 'none' && activeTool !== 'erase' && isLeft) {
      isDrawing.current = true;
      if (activeTool === 'freedraw') {
        setDrawingPoints([mapPos.x, mapPos.y]);
      } else if (activeTool === 'polygon') {
        if (e.evt.detail === 2) {
          if (polygonPoints.length >= 6) {
            addDrawing({ shape: 'polygon', points: polygonPoints, color: drawColor, strokeWidth: brushSize, opacity });
          }
          setPolygonPoints([]);
        } else {
          setPolygonPoints((p) => [...p, mapPos.x, mapPos.y]);
        }
        isDrawing.current = false;
      } else {
        setDrawingPoints([mapPos.x, mapPos.y, mapPos.x, mapPos.y]);
      }
    }

    // Erase
    if (toolMode === 'draw' && activeTool === 'erase' && isLeft) {
      const target = e.target;
      const id = target.id();
      if (id) {
        deleteDrawing(id);
      }
    }
  };

  // Mouse move
  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isPanning) {
      const dx = e.evt.clientX - panStart.current.x;
      const dy = e.evt.clientY - panStart.current.y;
      setPosition({ x: panStart.current.sx + dx, y: panStart.current.sy + dy });
      return;
    }
    if (!isDrawing.current) return;
    const mapPos = getMapPos();
    if (!mapPos) return;

    if (activeTool === 'freedraw') {
      setDrawingPoints((p) => [...p, mapPos.x, mapPos.y]);
    } else if (activeTool !== 'polygon') {
      setDrawingPoints((p) => { const arr = [...p]; arr[2] = mapPos.x; arr[3] = mapPos.y; return arr; });
    }
  };

  // Mouse up
  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (drawingPoints.length >= 4 && activeTool !== 'polygon') {
      addDrawing({ shape: activeTool as DrawShape, points: drawingPoints, color: drawColor, strokeWidth: brushSize, opacity });
    }
    setDrawingPoints([]);
  };

  // Double click to finish vehicle path
  const handleDblClick = () => {
    if (toolMode === 'special' && activeSpecialTool === 'vehicle-path') {
      finishVehiclePath();
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setPanMode(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        // Undo - simplified
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        // Redo - simplified
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        // Save - handled at page level
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedMarkerId) deleteMarker(selectedMarkerId);
        if (selectedDrawingId) deleteDrawing(selectedDrawingId);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setPanMode(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [selectedMarkerId, selectedDrawingId, deleteMarker, deleteDrawing, setPanMode]);

  // Render drawing shape
  const renderDrawing = (d: typeof drawings[0]) => {
    const props = {
      id: d.id,
      key: d.id,
      stroke: d.color,
      strokeWidth: d.strokeWidth,
      opacity: d.opacity,
      onClick: () => { if (activeTool === 'erase') deleteDrawing(d.id); else setSelectedDrawing(d.id); },
      onTap: () => { if (activeTool === 'erase') deleteDrawing(d.id); else setSelectedDrawing(d.id); },
    };

    switch (d.shape) {
      case 'freedraw':
      case 'line':
        return <Line {...props} points={d.points} lineCap="round" lineJoin="round" />;
      case 'arrow':
        return <Arrow {...props} points={d.points} pointerLength={10} pointerWidth={10} fill={d.color} />;
      case 'rectangle': {
        const [x1, y1, x2, y2] = d.points;
        return <Rect {...props} x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={Math.abs(x2 - x1)} height={Math.abs(y2 - y1)} />;
      }
      case 'circle': {
        const [cx, cy, ...rest] = d.points;
        const x2 = rest[0] ?? cx;
        const y2 = rest[1] ?? cy;
        const r = Math.sqrt((cx - x2) ** 2 + (cy - y2) ** 2);
        return <Ellipse {...props} x={cx} y={cy} radiusX={r} radiusY={r} />;
      }
      case 'polygon':
        return <Line {...props} points={d.points} closed fill={d.color} opacity={d.opacity * 0.2} />;
      default:
        return null;
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl glass" ref={containerRef}>
      {/* Map background */}
      <div className="absolute inset-0 grid-bg opacity-30" />

      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        scaleX={scale}
        scaleY={scale}
        x={position.x}
        y={position.y}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDblClick={handleDblClick}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isPanning || isPanMode ? 'grab' : toolMode === 'marker' || toolMode === 'draw' ? 'crosshair' : 'default' }}
      >
        {/* Map image layer */}
        <Layer listening={false}>
          {image && <KonvaImage image={image} width={MAP_W} height={MAP_H} />}
        </Layer>

        {/* Safe zones layer */}
        <Layer>
          {safeZones.map((zone) => (
            <Group key={zone.id}>
              <Circle
                x={zone.x}
                y={zone.y}
                radius={zone.radius}
                stroke="#3b82f6"
                strokeWidth={3}
                fill="rgba(59,130,246,0.06)"
                dash={[10, 6]}
                draggable
                onDragEnd={(e) => updateSafeZone(zone.id, { x: e.target.x(), y: e.target.y() })}
              />
              <Circle
                x={zone.x + zone.radius}
                y={zone.y}
                radius={8}
                fill="#3b82f6"
                draggable
                onDragMove={(e) => {
                  const newR = Math.max(20, Math.sqrt((e.target.x() - zone.x) ** 2 + (e.target.y() - zone.y) ** 2));
                  updateSafeZone(zone.id, { radius: newR });
                }}
              />
              <Text text={`Zone ${zone.circle}`} x={zone.x - 25} y={zone.y - 8} fontSize={14} fill="#60a5fa" fontStyle="bold" />
            </Group>
          ))}
        </Layer>

        {/* Drawings layer */}
        <Layer>
          {drawings.map(renderDrawing)}
          {/* Temp drawing preview */}
          {drawingPoints.length >= 4 && activeTool !== 'polygon' && (
            <Line
              points={drawingPoints}
              stroke={drawColor}
              strokeWidth={brushSize}
              opacity={opacity}
              lineCap="round"
              lineJoin="round"
              listening={false}
            />
          )}
          {/* Polygon temp preview */}
          {polygonPoints.length >= 4 && (
            <Line
              points={polygonPoints}
              stroke={drawColor}
              strokeWidth={brushSize}
              opacity={opacity}
              closed
              fill={`${drawColor}20`}
              listening={false}
            />
          )}
          {/* Vehicle path temp */}
          {vehiclePathPoints.length >= 4 && (
            <Line
              points={vehiclePathPoints}
              stroke="#f97316"
              strokeWidth={4}
              dash={[8, 4]}
              lineCap="round"
              listening={false}
            />
          )}
        </Layer>

        {/* Flight paths layer */}
        <Layer>
          {flightPaths.map((fp) => (
            <Arrow
              key={fp.id}
              points={[fp.startX, fp.startY, fp.endX, fp.endY]}
              stroke="#facc15"
              strokeWidth={3}
              dash={[10, 5]}
              fill="#facc15"
              pointerLength={15}
              pointerWidth={12}
            />
          ))}
          {flightStart && (
            <Circle x={flightStart.x} y={flightStart.y} radius={6} fill="#facc15" stroke="white" strokeWidth={2} />
          )}
        </Layer>

        {/* Vehicle paths layer */}
        <Layer>
          {vehiclePaths.map((vp) => (
            <Line key={vp.id} points={vp.points} stroke="#f97316" strokeWidth={4} dash={[8, 4]} lineCap="round" lineJoin="round" />
          ))}
        </Layer>

        {/* Markers layer */}
        <Layer>
          {markers.map((marker) => {
            const def = getMarkerDefinition(marker.type);
            const isSelected = selectedMarkerId === marker.id;
            return (
              <Group
                key={marker.id}
                x={marker.x}
                y={marker.y}
                draggable={toolMode === 'select'}
                onClick={() => setSelectedMarker(marker.id)}
                onDblClick={() => setSelectedMarker(marker.id)}
                onDragEnd={(e) => moveMarker(marker.id, e.target.x(), e.target.y())}
              >
                {isSelected && <Circle radius={20} stroke={marker.color} strokeWidth={2} dash={[4, 4]} />}
                <Circle radius={14} fill={marker.color} stroke="white" strokeWidth={2} shadowColor={marker.color} shadowBlur={10} />
                <Text text={marker.label} x={-30} y={18} width={60} align="center" fontSize={10} fill="white" fontStyle="bold" />
              </Group>
            );
          })}
        </Layer>

        {/* Players layer */}
        <Layer>
          {players.map((player) => {
            const isSelected = selectedPlayerId === player.id;
            return (
              <Group
                key={player.id}
                x={player.x}
                y={player.y}
                draggable
                onClick={() => setSelectedPlayer(player.id)}
                onDragEnd={(e) => movePlayer(player.id, e.target.x(), e.target.y())}
              >
                {isSelected && <Circle radius={24} stroke={player.color} strokeWidth={2} dash={[4, 4]} />}
                <Circle radius={16} fill={player.color} stroke="white" strokeWidth={2} shadowColor={player.color} shadowBlur={12} />
                <Text text={`P${player.slot}`} x={-16} y={-8} width={32} align="center" fontSize={12} fill="white" fontStyle="bold" />
                <Text text={player.name} x={-40} y={20} width={80} align="center" fontSize={11} fill="white" fontStyle="bold" />
                <Text text={player.role} x={-40} y={34} width={80} align="center" fontSize={9} fill="rgba(255,255,255,0.7)" />
              </Group>
            );
          })}
        </Layer>
      </Stage>

      {/* Map controls overlay */}
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
        <CtrlBtn onClick={resetView} title="Reset View"><CrosshairIcon /></CtrlBtn>
        <CtrlBtn onClick={() => fitToScreen()} title="Fit Screen"><FitIcon /></CtrlBtn>
        <CtrlBtn onClick={toggleFullscreen} title="Fullscreen">{isFullscreen ? <ExitFsIcon /> : <FsIcon />}</CtrlBtn>
      </div>

      {/* Zoom indicator */}
      <div className="absolute bottom-3 right-3 z-10 glass rounded-lg px-3 py-1.5 font-mono text-xs text-muted-foreground">
        Zoom: {Math.round(scale * 100)}%
      </div>

      {/* Vehicle path hint */}
      {toolMode === 'special' && activeSpecialTool === 'vehicle-path' && (
        <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 glass rounded-lg px-4 py-2 text-xs text-accent">
          Click to add waypoints. Double-click to finish.
        </div>
      )}
      {toolMode === 'special' && activeSpecialTool === 'flight' && (
        <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 glass rounded-lg px-4 py-2 text-xs text-accent">
          {flightStart ? 'Click end point' : 'Click start point'}
        </div>
      )}
    </div>
  );
}

function CtrlBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title} className={cn('glass flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-primary/20 hover:text-primary')}>
      {children}
    </button>
  );
}

function CrosshairIcon() {
  return <span className="text-base font-bold">⊕</span>;
}
function FitIcon() {
  return <span className="text-base font-bold">⛶</span>;
}
function FsIcon() {
  return <span className="text-base font-bold">⛶</span>;
}
function ExitFsIcon() {
  return <span className="text-base font-bold">⤧</span>;
}
