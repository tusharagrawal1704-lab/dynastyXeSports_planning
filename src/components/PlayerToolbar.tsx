import { motion } from 'framer-motion';
import { Users, Crown } from 'lucide-react';
import { useStrategyStore } from '@/store/strategyStore';
import { PLAYER_COLORS, PLAYER_ROLES, type PlayerRole } from '@/types/player';
import { cn } from '@/lib/utils';

export function PlayerToolbar() {
  const players = useStrategyStore((s) => s.players);
  const addPlayer = useStrategyStore((s) => s.addPlayer);
  const removePlayer = useStrategyStore((s) => s.removePlayer);
  const updatePlayer = useStrategyStore((s) => s.updatePlayer);
  const setSelectedPlayer = useStrategyStore((s) => s.setSelectedPlayer);
  const setToolMode = useStrategyStore((s) => s.setToolMode);

  return (
    <div className="glass flex flex-col gap-3 rounded-xl p-3">
      <div className="flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5 text-primary" />
        <span className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">Team</span>
      </div>

      <div className="space-y-2 max-h-[320px] overflow-y-auto custom-scroll pr-1">
        {[1, 2, 3, 4, 5].map((slot) => {
          const player = players.find((p) => p.slot === slot);
          const color = PLAYER_COLORS[slot - 1];
          return (
            <div key={slot} className="rounded-lg border border-white/10 bg-white/5 p-2">
              <div className="flex items-center gap-2">
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: color, boxShadow: `0 0 8px -2px ${color}` }}
                >
                  P{slot}
                </div>
                {player ? (
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-1">
                      <input
                        value={player.name}
                        onChange={(e) => updatePlayer(player.id, { name: e.target.value })}
                        className="w-full rounded bg-white/5 px-2 py-1 text-xs font-bold text-white outline-none ring-1 ring-white/10 focus:ring-primary/50"
                        placeholder={`Player ${slot}`}
                      />
                      {player.role === 'IGL' && (
                        <span title="IGL Leader">
                          <Crown className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        </span>
                      )}
                    </div>
                    <select
                      value={player.role}
                      onChange={(e) => updatePlayer(player.id, { role: e.target.value as PlayerRole })}
                      className="w-full rounded bg-white/5 px-2 py-1 text-[11px] font-semibold text-primary outline-none ring-1 ring-white/10 focus:ring-primary/50"
                    >
                      {PLAYER_ROLES.map((role) => (
                        <option key={role} value={role} className="bg-card text-white">{role}</option>
                      ))}
                    </select>
                    <div className="flex gap-1 pt-0.5">
                      <button
                        onClick={() => { setToolMode('player'); setSelectedPlayer(player.id); }}
                        className="flex-1 rounded bg-primary/15 py-0.5 text-[10px] font-semibold text-primary ring-1 ring-primary/30 hover:bg-primary/25"
                      >
                        Focus
                      </button>
                      <button
                        onClick={() => removePlayer(player.id)}
                        className="rounded bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-400 ring-1 ring-red-500/30 hover:bg-red-500/25"
                      >
                        Del
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => addPlayer(slot as 1 | 2 | 3 | 4 | 5)}
                    className="flex-1 rounded bg-white/5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-primary/15 hover:text-primary"
                  >
                    + Add Player {slot}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
