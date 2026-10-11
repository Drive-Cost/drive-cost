import { useCallback, useEffect } from 'react';
import { useFuelStore } from '../store/fuelStore';
import { useChargingStore } from '../store/chargingStore';
import { useMaintenanceStore } from '../store/maintenanceStore';
import { useExpenseStore } from '../store/expenseStore';
import { useRecurringExpenseStore } from '../store/recurringExpenseStore';

export type VehicleDataSource = 'fuel' | 'charging' | 'maintenance' | 'expenses' | 'recurring';
export type VehicleDataStatus = 'loading' | 'ready' | 'error';

export function useVehicleData(vehicleId: number | null, sources: readonly VehicleDataSource[]) {
  const fuel = useFuelStore(state => (vehicleId === null ? undefined : state.loadStates[vehicleId]));
  const charging = useChargingStore(state => (vehicleId === null ? undefined : state.loadStates[vehicleId]));
  const maintenance = useMaintenanceStore(state => (vehicleId === null ? undefined : state.loadStates[vehicleId]));
  const expenses = useExpenseStore(state => (vehicleId === null ? undefined : state.loadStates[vehicleId]));
  const recurring = useRecurringExpenseStore(state => (vehicleId === null ? undefined : state.loadStates[vehicleId]));
  const retry = useCallback(() => {
    if (vehicleId === null) return;
    const loaders = {
      fuel: useFuelStore.getState().loadFuelEntries,
      charging: useChargingStore.getState().loadChargingEntries,
      maintenance: useMaintenanceStore.getState().loadMaintenanceEntries,
      expenses: useExpenseStore.getState().loadExpenseEntries,
      recurring: useRecurringExpenseStore.getState().loadRecurringExpenses,
    };
    for (const source of sources) void loaders[source](vehicleId);
  }, [vehicleId, sources]);
  useEffect(retry, [retry]);
  const states = { fuel, charging, maintenance, expenses, recurring };
  const status: VehicleDataStatus =
    vehicleId === null
      ? 'ready'
      : sources.some(source => states[source]?.tag === 'error')
        ? 'error'
        : sources.some(source => states[source]?.tag !== 'ready')
          ? 'loading'
          : 'ready';
  return { status, retry };
}
