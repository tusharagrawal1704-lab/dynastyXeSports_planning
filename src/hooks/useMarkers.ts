import { useCallback } from 'react';
import { useStrategyStore } from '@/store/strategyStore';
import type { MarkerType } from '@/types/marker';

export function useMarkers() {
  const markers = useStrategyStore((s) => s.markers);
  const selectedMarkerId = useStrategyStore((s) => s.selectedMarkerId);
  const addMarker = useStrategyStore((s) => s.addMarker);
  const updateMarker = useStrategyStore((s) => s.updateMarker);
  const moveMarker = useStrategyStore((s) => s.moveMarker);
  const deleteMarker = useStrategyStore((s) => s.deleteMarker);
  const setSelectedMarker = useStrategyStore((s) => s.setSelectedMarker);

  const handleAdd = useCallback((type: MarkerType, x: number, y: number) => {
    addMarker(type, x, y);
  }, [addMarker]);

  const handleSelect = useCallback((id: string | null) => {
    setSelectedMarker(id);
  }, [setSelectedMarker]);

  const handleDelete = useCallback((id: string) => {
    deleteMarker(id);
  }, [deleteMarker]);

  return {
    markers,
    selectedMarkerId,
    addMarker: handleAdd,
    updateMarker,
    moveMarker,
    deleteMarker: handleDelete,
    selectMarker: handleSelect,
  };
}
