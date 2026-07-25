import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Crosshair } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VoiceChatBar } from '@/components/VoiceChatBar';

const MAP_LINKS = [
  { to: '/erangel', label: 'Erangel' },
  { to: '/miramar', label: 'Miramar' },
  { to: '/rondo', label: 'Rondo' },
];

export function Header() {
  const location = useLocation();

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="glass-strong border-b border-primary/15">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="group flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: 15, scale: 1.1 }}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent glow-neon"
            >
              <Crosshair className="h-5 w-5 text-white" />
            </motion.div>
            <div className="flex flex-col">
              <span className="font-display text-lg font-bold leading-tight tracking-tight">
                Dynasty<span className="text-neon">X</span> Esports
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-primary/80">
                Official Tactical Strategy Hub
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {MAP_LINKS.map((link) => {
              const active = location.pathname === link.to;
              const targetPath = location.search ? `${link.to}${location.search}` : link.to;
              return (
                <Link
                  key={link.to}
                  to={targetPath}
                  className={cn(
                    'relative rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                    active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {link.label}
                  {active && (
                    <motion.span
                      layoutId="header-active"
                      className="absolute inset-0 -z-10 rounded-lg bg-primary/15 ring-1 ring-primary/30"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <VoiceChatBar />
            <nav className="flex items-center gap-1 md:hidden">
              {MAP_LINKS.map((link) => {
                const targetPath = location.search ? `${link.to}${location.search}` : link.to;
                return (
                  <Link
                    key={link.to}
                    to={targetPath}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                      location.pathname === link.to ? 'bg-primary/15 text-primary ring-1 ring-primary/30' : 'text-muted-foreground'
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}

