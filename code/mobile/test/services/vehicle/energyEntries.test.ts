import { describe, expect, it } from 'vitest';
import { calculateTotalEnergyCost, calculateTotalMaintenanceCost } from '../../../src/services/vehicle/costCalculator';
import { EnergyEntrySource, getEnergyEntries } from '../../../src/services/vehicle/energyEntries';
import { buildVehicleHistory } from '../../../src/services/vehicle/vehicleHistory';
import { createMileageSnapshot } from '../../../src/services/vehicle/vehicleUsage';
import { FuelFillStatus } from '../../../src/models/FuelEntry';

const iceVehicle = {
    id: 1,
    clientId: 'ice-vehicle',
    brand: 'Toyota',
    model: 'Corolla',
    year: 2022,
    fuelType: 'Petrol',
    ownershipStartMileage: 8_000,
    trackingStartMileage: 9_000,
    currentOdometer: 12_000,
};

const evVehicle = {
    ...iceVehicle,
    id: 2,
    clientId: 'ev-vehicle',
    fuelType: 'EV',
    currentOdometer: 9_000,
};

const legacyEvFuelEntry = {
    id: 10,
    clientId: 'legacy-fuel-charge',
    vehicleId: 2,
    date: '2026-01-02T00:00:00.000Z',
    liters: 24,
    price: 9.6,
    odometer: 9_600,
    fillStatus: FuelFillStatus.Unknown,
};

const chargingEntry = {
    id: 20,
    clientId: 'charging-session',
    vehicleId: 2,
    date: '2026-01-03T00:00:00.000Z',
    kWh: 30,
    price: 12,
    odometer: 9_800,
};

describe('getEnergyEntries', () => {
    it('uses fuel entries as the authoritative ICE energy path', () => {
        const entries = getEnergyEntries(
            iceVehicle,
            [{ ...legacyEvFuelEntry, vehicleId: 1, clientId: 'ice-fuel' }],
            [{ ...chargingEntry, vehicleId: 1, clientId: 'unexpected-ice-charge' }],
        );

        expect(entries).toEqual([
            expect.objectContaining({ clientId: 'ice-fuel', source: EnergyEntrySource.Fuel, quantity: 24, amount: 9.6 }),
        ]);
    });

    it('uses charging entries as the authoritative EV energy path', () => {
        const entries = getEnergyEntries(evVehicle, [], [chargingEntry]);

        expect(entries).toEqual([
            expect.objectContaining({ clientId: 'charging-session', source: EnergyEntrySource.Charging, quantity: 30, amount: 12 }),
        ]);
        expect(calculateTotalEnergyCost(entries)).toBe(12);
    });

    it('keeps legacy EV fuel rows as energy records without changing their identity', () => {
        const entries = getEnergyEntries(evVehicle, [legacyEvFuelEntry], []);

        expect(entries).toEqual([
            expect.objectContaining({
                clientId: legacyEvFuelEntry.clientId,
                source: EnergyEntrySource.LegacyEvFuel,
                quantity: 24,
                amount: 9.6,
            }),
        ]);
        expect(legacyEvFuelEntry).toMatchObject({ clientId: 'legacy-fuel-charge', liters: 24, price: 9.6 });
    });

    it('includes each EV legacy and charging record exactly once', () => {
        const entries = getEnergyEntries(evVehicle, [legacyEvFuelEntry], [chargingEntry]);

        expect(entries.map((entry) => entry.clientId)).toEqual(['legacy-fuel-charge', 'charging-session']);
        expect(calculateTotalEnergyCost(entries)).toBe(21.6);
    });

    it('keeps dashboard inputs isolated to the active vehicle', () => {
        const entries = getEnergyEntries(
            evVehicle,
            [{ ...legacyEvFuelEntry, vehicleId: 1, clientId: 'other-fuel' }, legacyEvFuelEntry],
            [{ ...chargingEntry, vehicleId: 1, clientId: 'other-charge' }, chargingEntry],
        );

        expect(entries.map((entry) => entry.clientId)).toEqual(['legacy-fuel-charge', 'charging-session']);
    });

    it('reflects edits and deletions to legacy and charging records in the next aggregate', () => {
        const editedLegacy = { ...legacyEvFuelEntry, price: 10.5 };
        const afterEdit = getEnergyEntries(evVehicle, [editedLegacy], [chargingEntry]);
        const afterDeletion = getEnergyEntries(evVehicle, [], [chargingEntry]);

        expect(calculateTotalEnergyCost(afterEdit)).toBe(22.5);
        expect(calculateTotalEnergyCost(afterDeletion)).toBe(12);
    });
});

describe('energy entries in dashboard projections', () => {
    it('combines maintenance with EV energy records in cost, mileage, and history inputs', () => {
        const maintenanceEntry = {
            id: 30,
            clientId: 'maintenance-entry',
            vehicleId: 2,
            type: 'Service',
            description: 'Tyre rotation',
            cost: 45,
            date: '2026-01-04T00:00:00.000Z',
            odometer: 9_700,
        };
        const energyEntries = getEnergyEntries(evVehicle, [legacyEvFuelEntry], [chargingEntry]);
        const mileage = createMileageSnapshot(evVehicle, [legacyEvFuelEntry], [maintenanceEntry], [chargingEntry]);
        const history = buildVehicleHistory(evVehicle, [legacyEvFuelEntry], [maintenanceEntry], [chargingEntry]);

        expect(calculateTotalEnergyCost(energyEntries) + calculateTotalMaintenanceCost([maintenanceEntry])).toBe(66.6);
        expect(mileage.latestRecordedMileage).toBe(9_800);
        expect(history.map((event) => event.id)).toEqual(['maintenance-30', 'charging-20', 'fuel-10']);
        expect(history.map((event) => event.amount)).toEqual([45, 12, 9.6]);
    });
});
