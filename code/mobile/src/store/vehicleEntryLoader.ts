export type LoadState = { tag: 'loading' } | { tag: 'ready' } | { tag: 'error' };
export type VehicleLoadStates = Partial<Record<number, LoadState>>;

export function mergeVehicleEntries<Entry extends { vehicleId: number }>(
  current: Entry[],
  vehicleId: number,
  snapshot: Entry[]
): Entry[] {
  return [...current.filter(entry => entry.vehicleId !== vehicleId), ...snapshot];
}

/** Only the latest read for a vehicle may publish; committed writes invalidate older reads. */
export function createVehicleEntryLoader<Entry>(
  read: (vehicleId: number) => Promise<Entry[]>,
  commit: (vehicleId: number, entries: Entry[]) => void,
  status: (vehicleId: number, state: LoadState) => void
) {
  const generations = new Map<number, number>();
  const advance = (vehicleId: number) => {
    const generation = (generations.get(vehicleId) ?? 0) + 1;
    generations.set(vehicleId, generation);
    return generation;
  };
  return {
    load: async (vehicleId: number): Promise<void> => {
      const generation = advance(vehicleId);
      status(vehicleId, { tag: 'loading' });
      try {
        const entries = await read(vehicleId);
        if (generations.get(vehicleId) !== generation) return;
        commit(vehicleId, entries);
        status(vehicleId, { tag: 'ready' });
      } catch {
        if (generations.get(vehicleId) === generation) status(vehicleId, { tag: 'error' });
      }
    },
    publish: (vehicleId: number, entries: Entry[]) => {
      advance(vehicleId);
      commit(vehicleId, entries);
      status(vehicleId, { tag: 'ready' });
    },
  };
}
