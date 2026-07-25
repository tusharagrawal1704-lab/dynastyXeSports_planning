import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Users, StickyNote, History, Trash2, ChevronRight, X } from 'lucide-react';
import { useStrategyStore } from '@/store/strategyStore';
import { MARKER_DEFINITIONS, getMarkerDefinition } from '@/types/marker';
import { PLAYER_ROLES, type PlayerRole } from '@/types/player';
import { cn } from '@/lib/utils';

type Tab = 'markers' | 'players' | 'notes' | 'history';

export function Sidebar() {
  const [tab, setTab] = useState<Tab>('markers');
  const [collapsed, setCollapsed] = useState(false);

  const markers = useStrategyStore((s) => s.markers);
  const players = useStrategyStore((s) => s.players);
  const notes = useStrategyStore((s) => s.notes);
  const history = useStrategyStore((s) => s.history);
  const setNotes = useStrategyStore((s) => s.setNotes);
  const setSelectedMarker = useStrategyStore((s) => s.setSelectedMarker);
  const selectedMarkerId = useStrategyStore((s) => s.selectedMarkerId);
  const deleteMarker = useStrategyStore((s) => s.deleteMarker);
  const updatePlayer = useStrategyStore((s) => s.updatePlayer);
  const setSelectedPlayer = useStrategyStore((s) => s.setSelectedPlayer);
  const selectedPlayerId = useStrategyStore((s) => s.selectedPlayerId);

  const tabs: { id: Tab; label: string; icon: typeof MapPin; count: number }[] = [
    { id: 'markers', label: 'Markers', icon: MapPin, count: markers.length },
    { id: 'players', label: 'Players', icon: Users, count: players.length },
    { id: 'notes', label: 'Notes', icon: StickyNote, count: notes ? 1 : 0 },
    { id: 'history', label: 'History', icon: History, count: history.length },
  ];

  return (
    <div className="relative">
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="glass overflow-hidden rounded-2xl"
          >
            <div className="w-72 p-4">
              {/* Tabs */}
              <div className="mb-4 flex gap-1">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      'relative flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-xs font-medium transition-colors',
                      tab === t.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <t.icon className="h-4 w-4" />
                    <span className="text-[10px]">{t.label}</span>
                    {t.count > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/20 px-1 text-[9px] font-bold text-primary">
                        {t.count}
                      </span>
                    )}
                    {tab === t.id && (
                      <motion.span layoutId="sidebar-tab" className="absolute -bottom-px left-2 right-2 h-0.5 rounded-full bg-primary" />
                    )}
                  </button>
                ))}
              </div>

              <div className="h-px bg-white/10" />

              {/* Content */}
              <div className="custom-scroll mt-3 max-h-[60vh] overflow-y-auto">
                {tab === 'markers' && (
                  <div className="space-y-2">
                    {markers.length === 0 ? (
                      <EmptyState text="No markers placed yet" />
                    ) : (
                      markers.map((marker) => {
                        const def = getMarkerDefinition(marker.type);
                        const active = selectedMarkerId === marker.id;
                        return (
                          <div
                            key={marker.id}
                            onClick={() => setSelectedMarker(marker.id)}
                            className={cn(
                              'group flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 transition-all',
                              active ? 'border-primary/40 bg-primary/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
                            )}
                          >
                            <div className="h-8 w-8 shrink-0 rounded-full" style={{ backgroundColor: marker.color }} />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold">{marker.label}</div>
                              <div className="text-xs text-muted-foreground">{def.label}</div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteMarker(marker.id); }}
                              className="opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              <Trash2 className="h-4 w-4 text-red-400 hover:scale-110" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {tab === 'players' && (
                  <div className="space-y-2">
                    {players.length === 0 ? (
                      <EmptyState text="No players added" />
                    ) : (
                      players.map((player) => {
                        const active = selectedPlayerId === player.id;
                        return (
                          <div
                            key={player.id}
                            onClick={() => setSelectedPlayer(player.id)}
                            className={cn(
                              'cursor-pointer rounded-lg border p-2.5 transition-all',
                              active ? 'border-primary/40 bg-primary/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 shrink-0 rounded-full" style={{ backgroundColor: player.color }} />
                              <div className="min-w-0 flex-1">
                                <input
                                  value={player.name}
                                  onChange={(e) => updatePlayer(player.id, { name: e.target.value })}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full bg-transparent text-sm font-semibold outline-none"
                                />
                                <select
                                  value={player.role}
                                  onChange={(e) => updatePlayer(player.id, { role: e.target.value as PlayerRole })}
                                  onClick={(e) => e.stopPropagation()}
                                  className="bg-transparent text-xs text-muted-foreground outline-none"
                                >
                                  {PLAYER_ROLES.map((role) => (
                                    <option key={role} value={role} className="bg-card">{role}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {tab === 'notes' && (
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Write strategy notes here..."
                    className="custom-scroll h-64 w-full resize-none rounded-lg bg-white/5 p-3 text-sm outline-none ring-1 ring-white/10 focus:ring-primary/50"
                  />
                )}

                {tab === 'history' && (
                  <div className="space-y-1.5">
                    {history.length === 0 ? (
                      <EmptyState text="No actions yet" />
                    ) : (
                      history.map((entry) => (
                        <div key={entry.id} className="flex items-center gap-2 rounded-lg bg-white/5 p-2.5 text-xs">
                          <div className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                          <span className="flex-1 text-muted-foreground">{entry.description}</span>
                          <span className="font-mono text-[10px] text-muted-foreground/60">
                            {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setCollapsed((v) => !v)}
        className="absolute -left-3 top-1/2 z-10 flex h-8 w-6 -translate-y-1/2 items-center justify-center rounded-r-lg glass hover:bg-primary/20"
        aria-label="Toggle sidebar"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <X className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  );
}
