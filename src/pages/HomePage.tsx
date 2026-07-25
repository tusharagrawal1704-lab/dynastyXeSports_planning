import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Crosshair, ArrowRight, Zap, Users, Map as MapIcon, Target } from 'lucide-react';
import { AnimatedButton } from '@/components/AnimatedButton';

const MAP_CARDS = [
  {
    to: '/erangel',
    name: 'Erangel',
    img: '/maps/erangel.webp',
    desc: 'Classic temperate battleground with rolling fields and military bases.',
    gradient: 'from-emerald-900/40 to-slate-900/60',
  },
  {
    to: '/miramar',
    name: 'Miramar',
    img: '/maps/miramar.webp',
    desc: 'Vast arid desert with towering canyons and dense urban complexes.',
    gradient: 'from-amber-900/40 to-slate-900/60',
  },
  {
    to: '/rondo',
    name: 'Rondo',
    img: '/maps/rondo.webp',
    desc: 'Sprawling modern metropolis with dense city blocks and vertical combat.',
    gradient: 'from-indigo-900/40 to-slate-900/60',
  },
];

const FEATURES = [
  { icon: MapIcon, title: 'Interactive Maps', desc: 'Zoom, pan, and annotate on high-resolution BGMI maps' },
  { icon: Target, title: '12 Tactical Markers', desc: 'Attack, Rotate, Enemy, Loot, Vehicle, Sniper and more' },
  { icon: Users, title: 'Team Strategy', desc: 'Place 4 players with roles: IGL, Assaulter, Support, Sniper, Entry' },
  { icon: Zap, title: 'Drawing Tools', desc: 'Free draw, lines, arrows, circles, rectangles, polygons' },
];

export function HomePage() {
  return (
    <div className="relative min-h-screen pt-20">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute right-0 top-40 h-[300px] w-[300px] rounded-full bg-accent/15 blur-[100px]" />

        <div className="relative mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-semibold text-primary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              DynastyX Esports Tactical Hub
            </div>

            <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl lg:text-8xl">
              Dynasty<span className="text-neon">X</span> Esports<br />Strategy Planner
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Official BGMI Squad Strategy & Real-Time Tactical Hub
            </p>

            <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
              <Link to="/erangel"><AnimatedButton variant="primary" size="lg" glow><Crosshair className="h-5 w-5" />Start Planning<ArrowRight className="h-5 w-5" /></AnimatedButton></Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Map Cards */}
      <section className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="mb-10">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Choose Your <span className="text-neon">Battleground</span></h2>
          <p className="mt-2 text-muted-foreground">Select a map to start planning your tactical strategy.</p>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {MAP_CARDS.map((card, i) => (
            <motion.div
              key={card.to}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -6 }}
            >
              <Link to={card.to} className="group relative block overflow-hidden rounded-2xl glass">
                <div className={`relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br ${card.gradient}`}>
                  <img src={card.img} alt={card.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div whileHover={{ scale: 1.1 }} className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 backdrop-blur-md ring-1 ring-white/30 transition-all group-hover:bg-primary group-hover:ring-primary">
                      <Crosshair className="h-6 w-6 text-white" />
                    </motion.div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <h3 className="font-display text-2xl font-bold text-white">{card.name}</h3>
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-sm text-muted-foreground">{card.desc}</p>
                  <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-primary">
                    Open Tactical Map<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="glass rounded-2xl p-5"
            >
              <feature.icon className="h-8 w-8 text-primary" />
              <h3 className="mt-3 font-display text-lg font-bold">{feature.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
