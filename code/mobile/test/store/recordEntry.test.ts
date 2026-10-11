import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/database/db', async () => ({ db: (await import('../helpers/memorySqlite')).database }));
vi.mock('../../src/services/sync/syncService', () => ({ processSyncQueue: vi.fn().mockResolvedValue(undefined) }));

import { closeDatabase, execute, failNextReadContaining, readRows, resetDatabase } from '../helpers/memorySqlite';
import { useFuelStore } from '../../src/store/fuelStore';
import { useChargingStore } from '../../src/store/chargingStore';
import { useMaintenanceStore } from '../../src/store/maintenanceStore';
import { useVehicleStore } from '../../src/store/vehicleStore';
import { useExpenseStore } from '../../src/store/expenseStore';
import { useRecurringExpenseStore } from '../../src/store/recurringExpenseStore';
import { processSyncQueue } from '../../src/services/sync/syncService';

const fuel = {
  vehicleId: 1,
  date: '2026-10-11T00:00:00.000Z',
  liters: 40,
  price: 60,
  odometer: 1_200,
  fillStatus: 'full' as const,
};
const charge = { vehicleId: 1, date: '2026-10-11T00:00:00.000Z', kWh: 20, price: 10, odometer: 1_300 };
const maintenance = {
  vehicleId: 1,
  date: '2026-10-11T00:00:00.000Z',
  type: 'Service',
  description: '',
  cost: 100,
  odometer: 1_400,
};

beforeEach(() => {
  resetDatabase();
  vi.clearAllMocks();
  vi.mocked(processSyncQueue).mockResolvedValue(undefined);
  useFuelStore.setState({ fuelEntries: [] });
  useChargingStore.setState({ chargingEntries: [] });
  useMaintenanceStore.setState({ maintenanceEntries: [] });
  useExpenseStore.setState({ expenseEntries: [] });
  useRecurringExpenseStore.setState({ recurringExpenses: [] });
  useVehicleStore.setState({ vehicles: [], activeVehicleId: 1 });
});
afterEach(closeDatabase);

function odometer() {
  return readRows<{ currentOdometer: number }>('SELECT currentOdometer FROM vehicles')[0].currentOdometer;
}
function jobs() {
  return readRows<{ entityType: string; payload: string }>('SELECT entityType, payload FROM sync_queue ORDER BY id');
}

describe('atomic recorded entries through the real SQLite repositories', () => {
  it('returns the stored vehicle fields and retains its client identity on profile updates', async () => {
    const created = await useVehicleStore.getState().createVehicle({
      brand: 'Renault',
      model: 'Clio',
      year: 2023,
      ownershipStartMileage: 2_000,
      trackingStartMileage: 2_000,
      currentOdometer: 2_000,
      currentMileage: 999,
    });
    expect(created.id).toBe(2);
    expect(created.currentMileage).toBe(2_000);
    const update = { ...created, clientId: 'replacement-is-ignored', label: 'My Clio' };
    const saved = await useVehicleStore.getState().saveVehicle(update);
    expect(saved).toMatchObject({ id: 2, clientId: created.clientId, label: 'My Clio' });
    expect(useVehicleStore.getState().vehicles.find(vehicle => vehicle.id === 2)).toMatchObject(saved);
  });

  it('returns identity-complete expenses and commitments without changing their vehicle odometer', async () => {
    const expense = await useExpenseStore.getState().createExpenseEntry({
      vehicleId: 1,
      category: 'insurance',
      totalPaid: 480,
      date: '2026-10-11T00:00:00.000Z',
      odometer: 1_500,
    });
    const updated = await useExpenseStore.getState().updateExpenseEntry({ ...expense, totalPaid: 500 });
    expect(updated).toMatchObject({ id: expense.id, clientId: expense.clientId, totalPaid: 500 });
    const commitment = await useRecurringExpenseStore.getState().createRecurringExpense({
      vehicleId: 1,
      category: 'insurance',
      amount: 480,
      periodMonths: 12,
      startDate: '2026-10-11T00:00:00.000Z',
      active: true,
    });
    const edited = await useRecurringExpenseStore.getState().updateRecurringExpense({ ...commitment, amount: 500 });
    expect(edited).toMatchObject({ id: commitment.id, clientId: commitment.clientId, amount: 500 });
    await useRecurringExpenseStore.getState().setRecurringExpenseActive(commitment.id, 1, false);
    expect(useRecurringExpenseStore.getState().recurringExpenses[0]).toMatchObject({
      id: commitment.id,
      clientId: commitment.clientId,
      active: false,
    });
    expect(odometer()).toBe(1_000);
  });

  it('commits each entry, advances its vehicle, and queues the parent before the entry', async () => {
    const savedFuel = await useFuelStore.getState().createFuelEntry(fuel);
    const savedCharge = await useChargingStore.getState().createChargingEntry(charge);
    const savedMaintenance = await useMaintenanceStore.getState().createMaintenanceEntry(maintenance);
    for (const saved of [savedFuel, savedCharge, savedMaintenance]) {
      expect(saved.id).toBeGreaterThan(0);
      expect(saved.clientId).toBeTruthy();
    }
    expect(odometer()).toBe(1_400);
    expect(useVehicleStore.getState().vehicles[0].currentOdometer).toBe(1_400);
    expect(jobs().map(job => job.entityType)).toEqual([
      'vehicle',
      'fuel_entry',
      'vehicle',
      'charging_entry',
      'vehicle',
      'maintenance_entry',
    ]);
    expect(JSON.parse(jobs()[1].payload)).toMatchObject({ clientId: savedFuel.clientId, vehicleClientId: 'vehicle-1' });
  });

  it.each([
    ['fuel_entries', () => useFuelStore.getState().createFuelEntry(fuel)],
    ['charging_entries', () => useChargingStore.getState().createChargingEntry(charge)],
    ['maintenance_entries', () => useMaintenanceStore.getState().createMaintenanceEntry(maintenance)],
  ] as const)(
    'rolls back %s when odometer advancement fails, then retries without a duplicate',
    async (table, record) => {
      execute(`CREATE TRIGGER fail_odometer BEFORE UPDATE OF currentOdometer ON vehicles
      BEGIN SELECT RAISE(ABORT, 'Injected odometer failure.'); END;`);
      await expect(record()).rejects.toThrow('Injected odometer failure');
      expect(readRows(`SELECT * FROM ${table}`)).toHaveLength(0);
      expect(odometer()).toBe(1_000);
      expect(jobs()).toHaveLength(0);
      expect(processSyncQueue).not.toHaveBeenCalled();
      execute('DROP TRIGGER fail_odometer');
      await record();
      expect(readRows(`SELECT * FROM ${table}`)).toHaveLength(1);
      expect(jobs()).toHaveLength(2);
    }
  );

  it.each(['vehicle', 'fuel_entry'])(
    'rolls back all local changes when the %s outbox job cannot be stored',
    async entityType => {
      execute(`CREATE TRIGGER fail_outbox BEFORE INSERT ON sync_queue WHEN NEW.entityType = '${entityType}'
      BEGIN SELECT RAISE(ABORT, 'Injected outbox failure.'); END;`);
      await expect(useFuelStore.getState().createFuelEntry(fuel)).rejects.toThrow('Injected outbox failure');
      expect(readRows('SELECT * FROM fuel_entries')).toHaveLength(0);
      expect(odometer()).toBe(1_000);
      expect(jobs()).toHaveLength(0);
    }
  );

  it('rolls back before reporting success if a saved snapshot cannot be read', async () => {
    failNextReadContaining('FROM fuel_entries');
    await expect(useFuelStore.getState().createFuelEntry(fuel)).rejects.toThrow('snapshot read failure');
    expect(readRows('SELECT * FROM fuel_entries')).toHaveLength(0);
    expect(odometer()).toBe(1_000);
    expect(jobs()).toHaveLength(0);
    expect(useFuelStore.getState().fuelEntries).toEqual([]);
  });

  it('edits with the original identity and never lowers a previously recorded odometer', async () => {
    const saved = await useFuelStore.getState().createFuelEntry(fuel);
    const edited = await useFuelStore.getState().updateFuelEntry({ ...saved, liters: 45, odometer: 1_100 });
    expect(edited).toMatchObject({ id: saved.id, clientId: saved.clientId, liters: 45 });
    expect(readRows('SELECT * FROM fuel_entries')).toHaveLength(1);
    expect(odometer()).toBe(1_200);
    expect(JSON.parse(jobs()[2].payload)).toMatchObject({ currentOdometer: 1_200 });
  });

  it('keeps both the old entry and old vehicle reading when an edit fails', async () => {
    const saved = await useMaintenanceStore.getState().createMaintenanceEntry(maintenance);
    execute(`CREATE TRIGGER fail_odometer BEFORE UPDATE OF currentOdometer ON vehicles
      BEGIN SELECT RAISE(ABORT, 'Injected edit failure.'); END;`);
    await expect(
      useMaintenanceStore.getState().updateMaintenanceEntry({ ...saved, cost: 200, odometer: 1_600 })
    ).rejects.toThrow('Injected edit failure');
    expect(readRows<{ cost: number }>('SELECT cost FROM maintenance_entries')[0].cost).toBe(100);
    expect(odometer()).toBe(1_400);
    expect(jobs()).toHaveLength(2);
  });

  it('returns the committed record while the sync request remains unresolved', async () => {
    vi.mocked(processSyncQueue).mockReturnValue(new Promise(() => {}));
    const saved = await useChargingStore.getState().createChargingEntry(charge);
    expect(saved.id).toBeGreaterThan(0);
    expect(odometer()).toBe(1_300);
    expect(jobs()).toHaveLength(2);
    expect(processSyncQueue).toHaveBeenCalledOnce();
  });

  it('reports local success and retains both outbox jobs when background sync fails', async () => {
    vi.mocked(processSyncQueue).mockRejectedValueOnce(new Error('Offline.'));
    const saved = await useFuelStore.getState().createFuelEntry(fuel);
    expect(saved.id).toBeGreaterThan(0);
    expect(readRows('SELECT * FROM fuel_entries')).toHaveLength(1);
    expect(jobs()).toHaveLength(2);
  });
});
