import { useRef } from 'react';
import { Header } from '@/components/Header';
import { GoogleMapViewer } from '@/components/GoogleMapViewer';
import { DrawingTools } from '@/components/DrawingTools';
import { MarkerToolbar } from '@/components/MarkerToolbar';
import { PlayerToolbar } from '@/components/PlayerToolbar';
import { SpecialTools } from '@/components/SpecialTools';
import { Sidebar } from '@/components/Sidebar';
import { ExportBar } from '@/components/ExportBar';
import { useStrategyStore } from '@/store/strategyStore';
import { MousePointer2 } from 'lucide-react';

interface MapPageProps {
  mapId: string;
  mapName: string;
  mapSrc: string;
}

export function MapPage({ mapId, mapName, mapSrc }: MapPageProps) {
  const exportFnRef = useRef<(() => void) | null>(null);
  const toolMode = useStrategyStore((s) => s.toolMode);
  const setToolMode = useStrategyStore((s) => s.setToolMode);

  return (
    <div className="relative min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-[1600px] px-3 pt-20 pb-4 sm:px-4 lg:px-6">
        {/* Title bar */}
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold">{mapName} <span className="text-neon">Tactical Map</span></h1>
            <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/30 uppercase">
              {mapId}
            </span>
          </div>

          <ExportBar exportFnRef={exportFnRef} />
        </div>

        {/* Main layout */}
        <div className="flex flex-col gap-3 lg:flex-row">
          {/* Left toolbar */}
          <div className="flex gap-3 overflow-x-auto no-scrollbar lg:flex-col lg:overflow-visible">
            <div className="glass flex flex-col gap-3 rounded-xl p-3">
              <div className="flex items-center gap-1.5">
                <MousePointer2 className="h-3.5 w-3.5 text-primary" />
                <span className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mode</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
                <button
                  onClick={() => setToolMode('select')}
                  className={`flex h-10 items-center gap-2 rounded-lg border px-2 text-xs font-medium transition-all active:scale-95 cursor-pointer ${
                    toolMode === 'select'
                      ? 'border-primary/50 bg-primary/20 text-primary glow-neon scale-[1.02]'
                      : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground'
                  }`}
                >
                  <MousePointer2 className="h-4 w-4" />
                  <span className="hidden xl:inline">Pan / Select</span>
                </button>
              </div>
            </div>
            <MarkerToolbar />
            <DrawingTools />
            <PlayerToolbar />
            <SpecialTools />
          </div>

          {/* Single Interactive WebP Map Viewer */}
          <div className="relative flex-1">
            <div className="relative h-[68vh] lg:h-[80vh]">
              <GoogleMapViewer mapId={mapId} mapName={mapName} mapSrc={mapSrc} onExportRef={(fn) => { exportFnRef.current = fn; }} />
            </div>
          </div>

          {/* Right sidebar */}
          <div className="flex-shrink-0">
            <Sidebar />
          </div>
        </div>
      </div>
    </div>
  );
}

