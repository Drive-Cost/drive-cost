import { describe, expect, it } from 'vitest';
import { formatCostPerKm } from '../../../src/services/vehicle/costCalculator';
import {
    getDashboardMetricCopy,
    getMaintenanceShareDetail,
} from '../../../src/services/vehicle/dashboardPresentation';

const iceVehicle = {
    id: 1,
    clientId: 'ice-vehicle',
    brand: 'Toyota',
    model: 'Corolla',
    year: 2022,
    fuelType: 'Petrol',
    ownershipStartMileage: 8_000,
    trackingStartMileage: 10_000,
    currentOdometer: 12_000,
};

const evVehicle = { ...iceVehicle, id: 2, clientId: 'ev-vehicle', fuelType: 'EV' };

describe('dashboard metric presentation', () => {
    it('uses tracked, since-tracking copy for an ICE vehicle', () => {
        expect(getDashboardMetricCopy(iceVehicle)).toEqual({
            sectionTitle: 'Tracked costs',
            scopeLabel: 'Since tracking',
            categorySummary: 'Recorded fuel, maintenance, and ownership expenses. Depreciation is not included.',
            energyCostLabel: 'Tracked fuel cost',
            maintenanceCostLabel: 'Tracked maintenance cost',
            ownershipExpenseCostLabel: 'Tracked ownership expenses',
            costPerKmLabel: 'Tracked cost / km',
            drivenDistanceLabel: 'Driven since tracking',
        });
    });

    it('uses charging rather than fuel copy for an EV vehicle', () => {
        const copy = getDashboardMetricCopy(evVehicle);

        expect(copy.categorySummary).toBe('Recorded charging, maintenance, and ownership expenses. Depreciation is not included.');
        expect(copy.energyCostLabel).toBe('Tracked charging cost');
    });

    it('does not expose internal mileage-model language in normal dashboard copy', () => {
        const visibleCopy = Object.values(getDashboardMetricCopy(iceVehicle)).join(' ');

        expect(visibleCopy).not.toMatch(/tracking distance model|tracking baseline|ownership start|trackingStartMileage|ownershipStartMileage/i);
    });

    it('renders available and unavailable tracked cost per km honestly', () => {
        expect(getDashboardMetricCopy(iceVehicle).costPerKmLabel).toBe('Tracked cost / km');
        expect(formatCostPerKm(0.125)).toBe('EUR 0.13/km');
        expect(formatCostPerKm(null)).toBe('Unavailable');
    });

    it('describes the maintenance-share denominator using the categories in the calculation', () => {
        expect(getMaintenanceShareDetail(iceVehicle, 30)).toBe(
            'Share of tracked fuel, maintenance, and ownership expenses coming from maintenance.',
        );
        expect(getMaintenanceShareDetail(evVehicle, 30)).toBe(
            'Share of tracked charging, maintenance, and ownership expenses coming from maintenance.',
        );
        expect(getMaintenanceShareDetail(iceVehicle, 0)).toBe('All currently tracked costs are maintenance.');
    });
});
