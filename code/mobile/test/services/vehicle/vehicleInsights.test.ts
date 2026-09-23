import { describe, expect, it } from 'vitest';
import { EnergyEntrySource } from '../../../src/services/vehicle/energyEntries';
import { FuelFillStatus } from '../../../src/models/FuelEntry';
import { calculateFuelConsumption } from '../../../src/services/vehicle/fuelConsumption';
import { buildVehicleInsights } from '../../../src/services/vehicle/vehicleInsights';

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

describe('buildVehicleInsights', () => {
    it('keeps valid ICE transaction insights without claiming fuel consumption', () => {
        const insights = buildVehicleInsights(
            iceVehicle,
            [{ id: 1, clientId: 'fuel-1', vehicleId: 1, date: '2026-01-01', quantity: 40, amount: 60, odometer: 11_000, source: EnergyEntrySource.Fuel }],
            [],
            60,
            0,
            null,
        );

        expect(insights.map((insight) => insight.title)).toEqual(['Average fuel cost', 'Average fill-up size']);
        expect(insights.map((insight) => `${insight.title} ${insight.value} ${insight.detail}`).join(' ')).not.toMatch(/fuel use|L\/100 km/i);
    });

    it('keeps valid EV charge insights without claiming charging efficiency', () => {
        const fuelConsumption = calculateFuelConsumption([
            { id: 1, clientId: 'full-1', vehicleId: 2, date: '2026-01-01', liters: 40, price: 60, odometer: 10_000, fillStatus: FuelFillStatus.Full },
            { id: 2, clientId: 'full-2', vehicleId: 2, date: '2026-01-02', liters: 30, price: 45, odometer: 10_500, fillStatus: FuelFillStatus.Full },
        ]);
        const insights = buildVehicleInsights(
            evVehicle,
            [{ id: 2, clientId: 'charge-1', vehicleId: 2, date: '2026-01-01', quantity: 24, amount: 9.6, odometer: 10_500, source: EnergyEntrySource.Charging }],
            [],
            9.6,
            0,
            fuelConsumption,
        );

        expect(insights.map((insight) => insight.title)).toEqual(['Average energy cost', 'Average charge size']);
        expect(insights.map((insight) => `${insight.title} ${insight.value} ${insight.detail}`).join(' ')).not.toMatch(/energy use|kWh\/100 km/i);
        expect(insights.map((insight) => insight.title)).not.toContain('Latest fuel consumption');
    });

    it('restores a fuel-consumption insight only for a valid ICE full-to-full interval', () => {
        const fuelConsumption = calculateFuelConsumption([
            { id: 1, clientId: 'full-1', vehicleId: 1, date: '2026-01-01', liters: 45, price: 67.5, odometer: 10_000, fillStatus: FuelFillStatus.Full },
            { id: 2, clientId: 'partial-1', vehicleId: 1, date: '2026-01-02', liters: 20, price: 30, odometer: 10_300, fillStatus: FuelFillStatus.Partial },
            { id: 3, clientId: 'full-2', vehicleId: 1, date: '2026-01-03', liters: 35, price: 52.5, odometer: 10_700, fillStatus: FuelFillStatus.Full },
        ]);
        const insights = buildVehicleInsights(
            iceVehicle,
            [{ id: 1, clientId: 'fuel-1', vehicleId: 1, date: '2026-01-03', quantity: 35, amount: 52.5, odometer: 10_700, source: EnergyEntrySource.Fuel }],
            [],
            52.5,
            0,
            fuelConsumption,
        );

        expect(insights).toContainEqual({
            title: 'Latest fuel consumption',
            value: '7.9 L/100 km',
            detail: 'Measured across 700 km between full tanks.',
        });
    });

    it('retains the maintenance-share insight alongside valid energy insights', () => {
        const insights = buildVehicleInsights(
            iceVehicle,
            [{ id: 3, clientId: 'fuel-2', vehicleId: 1, date: '2026-01-01', quantity: 40, amount: 60, odometer: 11_000, source: EnergyEntrySource.Fuel }],
            [{ id: 4, clientId: 'service-1', vehicleId: 1, type: 'Service', description: '', cost: 40, date: '2026-01-02', odometer: 11_100 }],
            60,
            40,
            null,
        );

        expect(insights).toContainEqual({
            title: 'Maintenance share',
            value: '40%',
            detail: 'Share of tracked fuel, maintenance, and ownership expenses coming from maintenance.',
        });
    });

    it('uses ownership expenses in the maintenance-share denominator', () => {
        const insights = buildVehicleInsights(
            iceVehicle,
            [],
            [{ id: 5, clientId: 'service-2', vehicleId: 1, type: 'Service', description: '', cost: 40, date: '2026-01-02', odometer: 11_100 }],
            0,
            40,
            null,
            60,
        );

        expect(insights).toContainEqual({
            title: 'Maintenance share',
            value: '40%',
            detail: 'Share of tracked fuel, maintenance, and ownership expenses coming from maintenance.',
        });
    });
});
