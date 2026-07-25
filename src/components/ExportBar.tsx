import { useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Download, FileText, Save, FolderOpen, Share2, FileJson } from 'lucide-react';
import { useStrategyStore } from '@/store/strategyStore';
import { cn } from '@/lib/utils';

interface ExportBarProps {
  exportFnRef: React.MutableRefObject<(() => void) | null>;
}

export function ExportBar({ exportFnRef }: ExportBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const getStrategyJSON = useStrategyStore((s) => s.getStrategyJSON);
  const loadStrategy = useStrategyStore((s) => s.loadStrategy);

  const exportPNG = useCallback(() => {
    exportFnRef.current?.();
  }, [exportFnRef]);

  const exportPDF = useCallback(async () => {
    const { jsPDF } = await import('jspdf');
    const dataUrl = exportFnRef.current ? await getStageDataURL() : null;
    if (!dataUrl) return;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [1000, 1000] });
    pdf.addImage(dataUrl, 'PNG', 0, 0, 1000, 1000);
    pdf.save(`tactical-strategy-${Date.now()}.pdf`);
  }, []);

  const getStageDataURL = (): Promise<string | null> => {
    return new Promise((resolve) => {
      // The export function already captures PNG, we just need the data URL
      // For PDF, we'll trigger the PNG export but capture the URL instead
      const stage = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
      if (!stage) { resolve(null); return; }
      resolve(stage.toDataURL('image/png'));
    });
  };

  const saveStrategy = useCallback(() => {
    const json = getStrategyJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `tactical-strategy-${Date.now()}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }, [getStrategyJSON]);

  const loadStrategyFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        loadStrategy(data);
      } catch {
        alert('Invalid strategy file');
      }
    };
    reader.readAsText(file);
  }, [loadStrategy]);

  const shareStrategy = useCallback(async () => {
    const json = getStrategyJSON();
    try {
      await navigator.clipboard.writeText(json);
      alert('Strategy copied to clipboard!');
    } catch {
      alert('Failed to copy');
    }
  }, [getStrategyJSON]);

  const exportJSON = useCallback(() => {
    const json = getStrategyJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `tactical-export-${Date.now()}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }, [getStrategyJSON]);

  const buttons = [
    { icon: Download, label: 'PNG', onClick: exportPNG, color: 'primary' },
    { icon: FileText, label: 'PDF', onClick: exportPDF, color: 'primary' },
    { icon: Save, label: 'Save', onClick: saveStrategy, color: 'accent' },
    { icon: FolderOpen, label: 'Load', onClick: () => fileInputRef.current?.click(), color: 'accent' },
    { icon: Share2, label: 'Share', onClick: shareStrategy, color: 'primary' },
    { icon: FileJson, label: 'JSON', onClick: exportJSON, color: 'primary' },
  ];

  return (
    <div className="glass flex items-center gap-2 rounded-xl p-2">
      <input ref={fileInputRef} type="file" accept=".json" onChange={loadStrategyFile} className="hidden" />
      {buttons.map((btn) => (
        <motion.button
          key={btn.label}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={btn.onClick}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all',
            btn.color === 'primary'
              ? 'bg-primary/15 text-primary ring-1 ring-primary/30 hover:bg-primary/25'
              : 'bg-accent/15 text-accent ring-1 ring-accent/30 hover:bg-accent/25'
          )}
        >
          <btn.icon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{btn.label}</span>
        </motion.button>
      ))}
    </div>
  );
}
