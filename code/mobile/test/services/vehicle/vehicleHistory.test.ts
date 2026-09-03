import { describe, expect, it } from 'vitest';
import { buildVehicleHistory } from '../../../src/services/vehicle/vehicleHistory';

const vehicle = {
    id: 1,
    clientId: 'vehicle-1',
    brand: 'Toyota',
    model: 'Corolla',
    year: 2022,
    ownershipStartMileage: 8_000,
    trackingStartMileage: 9_000,
    currentOdometer: 12_000,
};

describe('buildVehicleHistory', () => {
    it('Given mixed vehicle entries, when building history, then returns every event newest first', () => {
        const history = buildVehicleHistory(
            vehicle,
            [
                {
                    id: 1,
                    clientId: 'fuel-1',
                    vehicleId: 1,
                    date: '2026-09-01T00:00:00.000Z',
                    liters: 40,
                    price: 70,
                    odometer: 11_000,
                },
                {
                    id: 2,
                    clientId: 'fuel-2',
                    vehicleId: 1,
                    date: '2026-07-01T00:00:00.000Z',
                    liters: 38,
                    price: 68,
                    odometer: 10_000,
                },
            ],
            [
                {
                    id: 3,
                    clientId: 'maintenance-1',
                    vehicleId: 1,
                    type: 'Oil service',
                    description: 'Oil and filter replacement',
                    cost: 95,
                    date: '2026-08-01T00:00:00.000Z',
                    odometer: 10_500,
                },
            ],
        );

        expect(history.map((event) => event.id)).toEqual(['fuel-1', 'maintenance-3', 'fuel-2']);
        expect(history).toHaveLength(3);
        expect(history[1]).toMatchObject({ title: 'Oil service', amount: 95 });
    });
});
