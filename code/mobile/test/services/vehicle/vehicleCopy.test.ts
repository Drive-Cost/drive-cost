import { describe, expect, it } from 'vitest';
import {
    editVehicleIntroCopy,
    energyTransactionCostLabel,
    fuelFillCopy,
    maintenanceIntroCopy,
    vehicleMileageCopy,
} from '../../../src/services/vehicle/vehicleCopy';

describe('normal vehicle screen copy', () => {
    it('uses an unambiguous total-transaction label for fuel and charging forms', () => {
        expect(energyTransactionCostLabel).toBe('Total paid');
    });

    it('gives new fuel entries clear full and partial choices without erasing a legacy unknown state', () => {
        expect(fuelFillCopy).toEqual({
            question: 'Filled tank?',
            fullTank: 'Full tank',
            partialFill: 'Partial fill',
            unknown: 'Fill status not recorded',
            newEntryHint: 'Choose one to measure fuel use accurately.',
        });
    });

    it('limits maintenance to maintenance-related work', () => {
        expect(maintenanceIntroCopy).toBe(
            'Build a history of service, repairs, parts, and other maintenance-related work.',
        );
        expect(maintenanceIntroCopy).not.toMatch(/ownership cost/i);
    });

    it('uses human mileage terms without exposing the tracking model', () => {
        const copy = `${Object.values(vehicleMileageCopy).join(' ')} ${editVehicleIntroCopy}`;

        expect(copy).toContain('Current odometer');
        expect(copy).toContain('Start tracking from');
        expect(copy).toContain('Ownership started at');
        expect(copy).not.toMatch(/tracking baseline|tracking start mileage|ownership start mileage|latest recorded mileage|tracking distance model/i);
    });
});
