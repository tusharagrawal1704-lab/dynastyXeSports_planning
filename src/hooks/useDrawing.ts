import { useCallback } from 'react';
import { useStrategyStore } from '@/store/strategyStore';
import type { DrawShape } from '@/types/drawing';

export function useDrawing() {
  const drawings = useStrategyStore((s) => s.drawings);
  const activeTool = useStrategyStore((s) => s.activeTool);
  const drawColor = useStrategyStore((s) => s.drawColor);
  const brushSize = useStrategyStore((s) => s.brushSize);
  const opacity = useStrategyStore((s) => s.opacity);
  const addDrawing = useStrategyStore((s) => s.addDrawing);
  const deleteDrawing = useStrategyStore((s) => s.deleteDrawing);
  const clearDrawings = useStrategyStore((s) => s.clearDrawings);
  const setDrawColor = useStrategyStore((s) => s.setDrawColor);
  const setBrushSize = useStrategyStore((s) => s.setBrushSize);
  const setOpacity = useStrategyStore((s) => s.setOpacity);
  const setActiveTool = useStrategyStore((s) => s.setActiveTool);

  const handleAddDrawing = useCallback((shape: DrawShape, points: number[]) => {
    const id = addDrawing({
      shape,
      points,
      color: drawColor,
      strokeWidth: brushSize,
      opacity,
    });
    return id;
  }, [addDrawing, drawColor, brushSize, opacity]);

  return {
    drawings,
    activeTool,
    drawColor,
    brushSize,
    opacity,
    addDrawing: handleAddDrawing,
    deleteDrawing,
    clearDrawings,
    setDrawColor,
    setBrushSize,
    setOpacity,
    setActiveTool,
  };
}
