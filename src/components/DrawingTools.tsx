import { motion } from 'framer-motion';
import {
  MousePointer2, Pencil, Minus, ArrowUpRight, Circle, Square, Hexagon,
  Eraser, Undo2, Redo2, Trash2, Palette,
} from 'lucide-react';
import { useStrategyStore } from '@/store/strategyStore';
import type { DrawTool } from '@/types/drawing';
import { cn } from '@/lib/utils';

const TOOLS: { id: DrawTool; label: string; icon: typeof Pencil }[] = [
  { id: 'freedraw', label: 'Free Draw', icon: Pencil },
  { id: 'line', label: 'Line', icon: Minus },
  { id: 'arrow', label: 'Arrow', icon: ArrowUpRight },
  { id: 'circle', label: 'Circle', icon: Circle },
  { id: 'rectangle', label: 'Rectangle', icon: Square },
  { id: 'polygon', label: 'Polygon', icon: Hexagon },
  { id: 'erase', label: 'Erase', icon: Eraser },
];

const COLORS = ['#38bdf8', '#f97316', '#a855f7', '#22c55e', '#ef4444', '#facc15', '#ffffff', '#64748b'];

export function DrawingTools() {
  const toolMode = useStrategyStore((s) => s.toolMode);
  const activeTool = useStrategyStore((s) => s.activeTool);
  const setActiveTool = useStrategyStore((s) => s.setActiveTool);
  const setToolMode = useStrategyStore((s) => s.setToolMode);
  const drawColor = useStrategyStore((s) => s.drawColor);
  const setDrawColor = useStrategyStore((s) => s.setDrawColor);
  const brushSize = useStrategyStore((s) => s.brushSize);
  const setBrushSize = useStrategyStore((s) => s.setBrushSize);
  const opacity = useStrategyStore((s) => s.opacity);
  const setOpacity = useStrategyStore((s) => s.setOpacity);
  const clearAll = useStrategyStore((s) => s.clearAll);
  const clearDrawings = useStrategyStore((s) => s.clearDrawings);

  const selectTool = (tool: DrawTool) => {
    setToolMode('draw');
    setActiveTool(tool);
  };

  return (
    <div className="glass flex flex-col gap-3 rounded-xl p-3">
      <div className="flex items-center gap-1.5">
        <span className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">Draw</span>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => selectTool(tool.id)}
            className={cn(
              'group relative flex h-10 items-center gap-2 rounded-lg border px-2 text-xs font-medium transition-all active:scale-95 cursor-pointer',
              activeTool === tool.id && toolMode === 'draw'
                ? 'border-primary/50 bg-primary/20 text-primary glow-neon scale-[1.02]'
                : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground'
            )}
            title={tool.label}
          >
            <tool.icon className="h-4 w-4 shrink-0" />
            <span className="hidden xl:inline">{tool.label}</span>
          </button>
        ))}
      </div>

      <div className="h-px bg-white/10" />

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Palette className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Color</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {COLORS.map((color) => (
            <button
              key={color}
              onClick={() => setDrawColor(color)}
              className={cn(
                'h-6 w-6 rounded-md border-2 transition-all',
                drawColor === color ? 'border-white scale-110' : 'border-transparent hover:scale-110'
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Brush</span>
          <span className="font-mono text-xs text-primary">{brushSize}px</span>
        </div>
        <input
          type="range"
          min={1}
          max={20}
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          className="w-full accent-primary"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Opacity</span>
          <span className="font-mono text-xs text-primary">{Math.round(opacity * 100)}%</span>
        </div>
        <input
          type="range"
          min={10}
          max={100}
          value={Math.round(opacity * 100)}
          onChange={(e) => setOpacity(Number(e.target.value) / 100)}
          className="w-full accent-primary"
        />
      </div>

      <div className="h-px bg-white/10" />

      <div className="grid grid-cols-2 gap-1.5">
        <ToolBtn icon={Undo2} label="Undo" onClick={() => {}} />
        <ToolBtn icon={Redo2} label="Redo" onClick={() => {}} />
        <ToolBtn icon={Trash2} label="Clear" onClick={clearDrawings} danger />
        <ToolBtn icon={Eraser} label="Clear All" onClick={clearAll} danger />
      </div>
    </div>
  );
}

function ToolBtn({ icon: Icon, label, onClick, danger }: { icon: typeof Undo2; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        'flex h-10 items-center justify-center gap-1.5 rounded-lg border text-xs font-medium transition-all',
        danger
          ? 'border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/20'
          : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground'
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden xl:inline">{label}</span>
    </motion.button>
  );
}
