import { describe, expect, it } from 'vitest';
import { todayCalendarDate } from '../../src/domain/entryDate';
import { initializeVehicleTrackingStartDate } from '../../src/domain/vehicleTracking';

const vehicle = {
    id: 1,
    clientId: 'vehicle-1',
    brand: 'Toyota',
    model: 'Corolla',
    year: 2022,
    ownershipStartMileage: 8_000,
    trackingStartMileage: 10_000,
    currentOdometer: 12_000,
};

describe('vehicle temporal tracking anchor', () => {
    it('initializes a new vehicle with the local calendar date', () => {
        const localDate = new Date(2026, 8, 6, 0, 30);
        expect(todayCalendarDate(localDate)).toBe('2026-09-06');
        expect(initializeVehicleTrackingStartDate(vehicle, localDate).trackingStartDate).toBe('2026-09-06');
    });

    it('preserves an explicit tracking start date rather than replacing it', () => {
        expect(initializeVehicleTrackingStartDate({ ...vehicle, trackingStartDate: '2026-08-01' }, new Date(2026, 8, 6)))
            .toMatchObject({ trackingStartDate: '2026-08-01', clientId: 'vehicle-1' });
    });
});
