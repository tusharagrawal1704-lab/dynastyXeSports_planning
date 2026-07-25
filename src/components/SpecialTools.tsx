import { motion } from 'framer-motion';
import { Plane, Car, CircleDot } from 'lucide-react';
import { useStrategyStore } from '@/store/strategyStore';
import type { SpecialTool } from '@/types/drawing';
import { cn } from '@/lib/utils';

const TOOLS: { id: SpecialTool; label: string; icon: typeof Plane }[] = [
  { id: 'flight', label: 'Flight Path', icon: Plane },
  { id: 'vehicle-path', label: 'Vehicle Path', icon: Car },
  { id: 'zone', label: 'Safe Zone', icon: CircleDot },
];

export function SpecialTools() {
  const toolMode = useStrategyStore((s) => s.toolMode);
  const activeSpecialTool = useStrategyStore((s) => s.activeSpecialTool);
  const setActiveSpecialTool = useStrategyStore((s) => s.setActiveSpecialTool);
  const setToolMode = useStrategyStore((s) => s.setToolMode);
  const safeZones = useStrategyStore((s) => s.safeZones);

  const select = (tool: SpecialTool) => {
    setToolMode('special');
    setActiveSpecialTool(tool);
  };

  return (
    <div className="glass flex flex-col gap-3 rounded-xl p-3">
      <div className="flex items-center gap-1.5">
        <Plane className="h-3.5 w-3.5 text-accent" />
        <span className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">Special</span>
      </div>

      <div className="grid grid-cols-1 gap-1.5">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => select(tool.id)}
            className={cn(
              'flex h-10 items-center gap-2 rounded-lg border px-2 text-xs font-medium transition-all active:scale-95 cursor-pointer',
              activeSpecialTool === tool.id && toolMode === 'special'
                ? 'border-accent/50 bg-accent/20 text-accent glow-orange scale-[1.02]'
                : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground'
            )}
          >
            <tool.icon className="h-4 w-4 shrink-0" />
            <span className="hidden xl:inline">{tool.label}</span>
          </button>
        ))}
      </div>

      {safeZones.length > 0 && (
        <>
          <div className="h-px bg-white/10" />
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Safe Zones ({safeZones.length})</span>
            {safeZones.map((zone) => (
              <div key={zone.id} className="flex items-center gap-2 rounded-lg bg-white/5 p-2 text-xs">
                <div className="h-4 w-4 rounded-full border-2 border-blue-400" />
                <span>Circle {zone.circle}</span>
                <span className="ml-auto font-mono text-muted-foreground">{Math.round(zone.radius)}px</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
