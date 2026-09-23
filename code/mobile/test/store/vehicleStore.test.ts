import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    addVehicle: vi.fn(),
    deleteVehicleById: vi.fn(),
    getVehicles: vi.fn(),
    removePendingVehicleUpserts: vi.fn(),
    requireVehicleForSync: vi.fn(),
    persistAndQueueSync: vi.fn(),
    toVehicleSyncPayload: vi.fn(),
    createClientId: vi.fn(),
}));

vi.mock('../../src/database/vehicleRepository', () => ({
    addVehicle: mocks.addVehicle,
    getVehicles: mocks.getVehicles,
    updateVehicle: vi.fn(),
    updateVehicleCurrentOdometer: vi.fn(),
    deleteVehicleById: mocks.deleteVehicleById,
}));
vi.mock('../../src/database/syncRepository', () => ({ removePendingVehicleUpserts: mocks.removePendingVehicleUpserts }));
vi.mock('../../src/services/sync/offlineSync', () => ({ persistAndQueueSync: mocks.persistAndQueueSync }));
vi.mock('../../src/services/sync/syncPayload', () => ({ toVehicleSyncPayload: mocks.toVehicleSyncPayload }));
vi.mock('../../src/domain/identity', () => ({ createClientId: mocks.createClientId }));
vi.mock('../../src/services/sync/vehicleClientId', () => ({ requireVehicleForSync: mocks.requireVehicleForSync }));

import { useVehicleStore } from '../../src/store/vehicleStore';

const newVehicle = {
    brand: 'Toyota',
    model: 'Corolla',
    year: 2022,
    fuelType: 'Petrol',
    ownershipStartMileage: 18_000,
    trackingStartMileage: 18_000,
    trackingStartDate: '2026-09-06',
    currentOdometer: 18_000,
};

describe('vehicle creation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useVehicleStore.setState({ vehicles: [], activeVehicleId: null });
        mocks.createClientId.mockReturnValue('vehicle-client-42');
        mocks.persistAndQueueSync.mockImplementation(async (_entity, _operation, persist) => persist({}));
        mocks.toVehicleSyncPayload.mockImplementation((vehicle) => vehicle);
        mocks.getVehicles.mockImplementation(async () => [{ id: 42, clientId: 'vehicle-client-42', ...newVehicle }]);
    });

    it('persists the locally initialized vehicle through the outbox and makes it active', async () => {
        await useVehicleStore.getState().createVehicle(newVehicle);

        expect(mocks.addVehicle).toHaveBeenCalledWith(
            { ...newVehicle, clientId: 'vehicle-client-42' },
            {},
        );
        expect(mocks.persistAndQueueSync).toHaveBeenCalledOnce();
        expect(useVehicleStore.getState()).toMatchObject({
            activeVehicleId: 42,
            vehicles: [{ id: 42, clientId: 'vehicle-client-42', currentOdometer: 18_000, trackingStartMileage: 18_000 }],
        });
    });

    it('changes the active vehicle without changing the vehicle list', () => {
        const first = { id: 1, clientId: 'vehicle-a', ...newVehicle };
        const second = { id: 2, clientId: 'vehicle-b', ...newVehicle };
        useVehicleStore.setState({ vehicles: [first, second], activeVehicleId: 1 });

        useVehicleStore.getState().setActiveVehicle(2);

        expect(useVehicleStore.getState()).toMatchObject({ vehicles: [first, second], activeVehicleId: 2 });
    });

    it('keeps the active vehicle when deleting a different vehicle', async () => {
        const active = { id: 2, clientId: 'vehicle-b', ...newVehicle };
        useVehicleStore.setState({ vehicles: [{ id: 1, clientId: 'vehicle-a', ...newVehicle }, active], activeVehicleId: 2 });
        mocks.requireVehicleForSync.mockResolvedValue({ id: 1, clientId: 'vehicle-a', ...newVehicle });
        mocks.getVehicles.mockResolvedValue([active]);

        await useVehicleStore.getState().deleteVehicle(1);

        expect(useVehicleStore.getState()).toMatchObject({ vehicles: [active], activeVehicleId: 2 });
    });

    it('selects the first remaining stable vehicle when deleting the active vehicle', async () => {
        const replacement = { id: 2, clientId: 'vehicle-b', ...newVehicle };
        useVehicleStore.setState({ vehicles: [{ id: 1, clientId: 'vehicle-a', ...newVehicle }, replacement], activeVehicleId: 1 });
        mocks.requireVehicleForSync.mockResolvedValue({ id: 1, clientId: 'vehicle-a', ...newVehicle });
        mocks.getVehicles.mockResolvedValue([replacement]);

        await useVehicleStore.getState().deleteVehicle(1);

        expect(useVehicleStore.getState()).toMatchObject({ vehicles: [replacement], activeVehicleId: 2 });
    });

    it('clears the active vehicle when deleting the only vehicle and queues one atomic vehicle tombstone', async () => {
        useVehicleStore.setState({ vehicles: [{ id: 1, clientId: 'vehicle-a', ...newVehicle }], activeVehicleId: 1 });
        mocks.requireVehicleForSync.mockResolvedValue({ id: 1, clientId: 'vehicle-a', ...newVehicle });
        mocks.getVehicles.mockResolvedValue([]);

        await useVehicleStore.getState().deleteVehicle(1);

        expect(mocks.removePendingVehicleUpserts).toHaveBeenCalledWith('vehicle-a', {});
        expect(mocks.deleteVehicleById).toHaveBeenCalledWith(1, {});
        expect(mocks.persistAndQueueSync).toHaveBeenCalledWith('vehicle', 'delete', expect.any(Function));
        expect(useVehicleStore.getState()).toMatchObject({ vehicles: [], activeVehicleId: null });
    });
});
