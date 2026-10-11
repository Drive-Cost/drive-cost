import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../src/database/db', async () => ({ db: (await import('../helpers/memorySqlite')).database }));
vi.mock('../../src/services/sync/syncService', () => ({ processSyncQueue: vi.fn().mockResolvedValue(undefined) }));
import { closeDatabase, execute, failNextReadContaining, readRows, resetDatabase } from '../helpers/memorySqlite';
import { useFuelStore } from '../../src/store/fuelStore';
import { useChargingStore } from '../../src/store/chargingStore';
import { useMaintenanceStore } from '../../src/store/maintenanceStore';
import { useExpenseStore } from '../../src/store/expenseStore';
import { useRecurringExpenseStore } from '../../src/store/recurringExpenseStore';
import { useVehicleStore } from '../../src/store/vehicleStore';
import { processSyncQueue } from '../../src/services/sync/syncService';

const event = { vehicleId: 1, date: '2026-10-11T00:00:00.000Z', odometer: 1_200 };
const cases = [
  {
    table: 'fuel_entries',
    entity: 'fuel_entry',
    create: () => useFuelStore.getState().createFuelEntry({ ...event, liters: 40, price: 60, fillStatus: 'full' }),
    remove: (id: number) => useFuelStore.getState().deleteFuelEntry(id, 1),
    cache: () => useFuelStore.getState().fuelEntries,
  },
  {
    table: 'charging_entries',
    entity: 'charging_entry',
    create: () => useChargingStore.getState().createChargingEntry({ ...event, kWh: 20, price: 10 }),
    remove: (id: number) => useChargingStore.getState().deleteChargingEntry(id, 1),
    cache: () => useChargingStore.getState().chargingEntries,
  },
  {
    table: 'maintenance_entries',
    entity: 'maintenance_entry',
    create: () =>
      useMaintenanceStore.getState().createMaintenanceEntry({ ...event, type: 'Service', description: '', cost: 100 }),
    remove: (id: number) => useMaintenanceStore.getState().deleteMaintenanceEntry(id, 1),
    cache: () => useMaintenanceStore.getState().maintenanceEntries,
  },
  {
    table: 'ownership_expenses',
    entity: 'expense_entry',
    create: () => useExpenseStore.getState().createExpenseEntry({ ...event, category: 'insurance', totalPaid: 500 }),
    remove: (id: number) => useExpenseStore.getState().deleteExpenseEntry(id, 1),
    cache: () => useExpenseStore.getState().expenseEntries,
  },
  {
    table: 'recurring_expenses',
    entity: 'recurring_expense',
    create: () =>
      useRecurringExpenseStore.getState().createRecurringExpense({
        vehicleId: 1,
        category: 'insurance',
        amount: 500,
        periodMonths: 12,
        startDate: event.date,
        active: true,
      }),
    remove: (id: number) => useRecurringExpenseStore.getState().deleteRecurringExpense(id, 1),
    cache: () => useRecurringExpenseStore.getState().recurringExpenses,
  },
];
beforeEach(() => {
  resetDatabase();
  vi.clearAllMocks();
  vi.mocked(processSyncQueue).mockResolvedValue(undefined);
  useFuelStore.setState({ fuelEntries: [], loadStates: {} });
  useChargingStore.setState({ chargingEntries: [], loadStates: {} });
  useMaintenanceStore.setState({ maintenanceEntries: [], loadStates: {} });
  useExpenseStore.setState({ expenseEntries: [], loadStates: {} });
  useRecurringExpenseStore.setState({ recurringExpenses: [], loadStates: {} });
  useVehicleStore.setState({ vehicles: [], activeVehicleId: 1 });
});
afterEach(closeDatabase);

describe.each(cases)('$entity deletion', ({ table, entity, create, remove, cache }) => {
  it('rolls back the delete and tombstone if the resulting snapshot fails, then safely retries', async () => {
    const saved = await create();
    const queued = readRows('SELECT * FROM sync_queue');
    failNextReadContaining(`FROM ${table}`);
    await expect(remove(saved.id)).rejects.toThrow('snapshot read failure');
    expect(readRows(`SELECT * FROM ${table}`)).toHaveLength(1);
    expect(readRows('SELECT * FROM sync_queue')).toEqual(queued);
    expect(cache()).toEqual([expect.objectContaining({ id: saved.id })]);
    await remove(saved.id);
    expect(cache()).toEqual([]);
    expect(readRows(`SELECT * FROM ${table}`)).toEqual([]);
    const tombstones = readRows<{ entityType: string; payload: string }>(
      "SELECT * FROM sync_queue WHERE operation = 'delete'"
    );
    expect(tombstones).toHaveLength(1);
    expect(tombstones[0].entityType).toBe(entity);
    expect(JSON.parse(tombstones[0].payload)).toEqual({ clientId: saved.clientId });
  });

  it('retains the entry when its tombstone cannot be queued', async () => {
    const saved = await create();
    execute(
      "CREATE TRIGGER fail_delete_job BEFORE INSERT ON sync_queue WHEN NEW.operation = 'delete' BEGIN SELECT RAISE(ABORT, 'Outbox failure'); END;"
    );
    await expect(remove(saved.id)).rejects.toThrow('Outbox failure');
    expect(readRows(`SELECT * FROM ${table}`)).toHaveLength(1);
    expect(cache()).toHaveLength(1);
  });

  it('completes locally without waiting for sync', async () => {
    const saved = await create();
    vi.mocked(processSyncQueue).mockReturnValue(new Promise(() => {}));
    await remove(saved.id);
    expect(cache()).toEqual([]);
  });
});

it('keeps vehicle data and selection if its deletion snapshot cannot be read', async () => {
  await useVehicleStore.getState().loadVehicles();
  failNextReadContaining('FROM vehicles');
  await expect(useVehicleStore.getState().deleteVehicle(1)).rejects.toThrow('snapshot read failure');
  expect(readRows('SELECT * FROM vehicles')).toHaveLength(1);
  expect(useVehicleStore.getState().activeVehicleId).toBe(1);
  expect(readRows('SELECT * FROM sync_queue')).toEqual([]);
});
