import { motion } from 'framer-motion';
import {
  Swords, RotateCw, Skull, Package, Car, Crosshair,
  AlertTriangle, Tent, Cloud, Bomb, Eye, Plane,
  MousePointer2, MapPin,
} from 'lucide-react';
import { useStrategyStore } from '@/store/strategyStore';
import { MARKER_DEFINITIONS, type MarkerType } from '@/types/marker';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, typeof Swords> = {
  swords: Swords,
  rotate: RotateCw,
  skull: Skull,
  package: Package,
  car: Car,
  crosshair: Crosshair,
  alert: AlertTriangle,
  tent: Tent,
  cloud: Cloud,
  grenade: Bomb,
  eye: Eye,
  plane: Plane,
};

export function MarkerToolbar() {
  const activeMarkerType = useStrategyStore((s) => s.activeMarkerType);
  const setActiveMarkerType = useStrategyStore((s) => s.setActiveMarkerType);
  const setToolMode = useStrategyStore((s) => s.setToolMode);
  const toolMode = useStrategyStore((s) => s.toolMode);

  const selectMarker = (type: MarkerType) => {
    setToolMode('marker');
    setActiveMarkerType(type);
  };

  return (
    <div className="glass flex flex-col gap-3 rounded-xl p-3">
      <div className="flex items-center gap-1.5">
        <MapPin className="h-3.5 w-3.5 text-accent" />
        <span className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">Markers</span>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {MARKER_DEFINITIONS.map((marker) => {
          const Icon = ICON_MAP[marker.icon] ?? MapPin;
          const active = toolMode === 'marker' && activeMarkerType === marker.type;
          return (
            <button
              key={marker.type}
              onClick={() => selectMarker(marker.type)}
              className={cn(
                'group relative flex h-10 items-center gap-2 rounded-lg border px-2 text-xs font-medium transition-all active:scale-95 cursor-pointer',
                active
                  ? 'border-white/40 bg-white/15 text-white scale-[1.02]'
                  : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground'
              )}
              style={active ? { borderColor: marker.color, boxShadow: `0 0 12px -2px ${marker.color}80` } : undefined}
              title={marker.label}
            >
              <Icon className="h-4 w-4 shrink-0" style={{ color: marker.color }} />
              <span className="hidden xl:inline">{marker.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
