import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Check } from 'lucide-react';
import { useStrategyStore } from '@/store/strategyStore';
import { MARKER_DEFINITIONS, type MarkerType } from '@/types/marker';
import { cn } from '@/lib/utils';

const COLORS = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899', '#ffffff', '#64748b'];

export function MarkerEditor() {
  const selectedMarkerId = useStrategyStore((s) => s.selectedMarkerId);
  const markers = useStrategyStore((s) => s.markers);
  const updateMarker = useStrategyStore((s) => s.updateMarker);
  const deleteMarker = useStrategyStore((s) => s.deleteMarker);
  const setSelectedMarker = useStrategyStore((s) => s.setSelectedMarker);

  const marker = markers.find((m) => m.id === selectedMarkerId);
  if (!marker) return null;

  return (
    <AnimatePresence>
      {marker && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="glass-strong absolute bottom-4 left-1/2 z-30 w-80 -translate-x-1/2 rounded-2xl p-5 sm:left-4 sm:translate-x-0"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-primary">Edit Marker</h3>
            <button onClick={() => setSelectedMarker(null)} className="rounded-lg p-1 hover:bg-white/10">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Label */}
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Label</label>
            <input
              value={marker.label}
              onChange={(e) => updateMarker(marker.id, { label: e.target.value })}
              className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-primary/50"
              placeholder="Marker label"
            />
          </div>

          {/* Icon type */}
          <div className="mb-3">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Icon</label>
            <div className="custom-scroll flex gap-1.5 overflow-x-auto pb-1">
              {MARKER_DEFINITIONS.map((def) => (
                <button
                  key={def.type}
                  onClick={() => updateMarker(marker.id, { type: def.type as MarkerType, color: def.color, icon: def.icon })}
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 transition-all',
                    marker.type === def.type ? 'border-white scale-110' : 'border-transparent hover:scale-110'
                  )}
                  style={{ backgroundColor: def.color }}
                  title={def.label}
                >
                  <span className="text-[10px] font-bold text-white">{def.label.slice(0, 2)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div className="mb-3">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Color</label>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => updateMarker(marker.id, { color })}
                  className={cn(
                    'h-7 w-7 rounded-md border-2 transition-all',
                    marker.color === color ? 'border-white scale-110' : 'border-transparent hover:scale-110'
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes</label>
            <textarea
              value={marker.notes}
              onChange={(e) => updateMarker(marker.id, { notes: e.target.value })}
              className="custom-scroll h-16 w-full resize-none rounded-lg bg-white/5 px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-primary/50"
              placeholder="Add tactical notes..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedMarker(null)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary/15 py-2 text-sm font-semibold text-primary ring-1 ring-primary/30 hover:bg-primary/25"
            >
              <Check className="h-4 w-4" /> Done
            </button>
            <button
              onClick={() => deleteMarker(marker.id)}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-400 ring-1 ring-red-500/30 hover:bg-red-500/25"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
