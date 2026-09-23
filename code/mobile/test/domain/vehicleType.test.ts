import { describe, expect, it } from 'vitest';
import { fuelTypeForVehicleType, vehicleTypeForFuelType, vehicleTypeLabelForFuelType, vehicleTypeOptions } from '../../src/domain/vehicleType';

describe('controlled vehicle types', () => {
    it('maps every onboarding choice to the existing stored fuel-type representation', () => {
        expect(vehicleTypeOptions.map((option) => [option.id, fuelTypeForVehicleType(option.id)])).toEqual([
            ['petrol', 'Petrol'],
            ['diesel', 'Diesel'],
            ['electric', 'EV'],
            ['hybrid', 'Hybrid'],
            ['phev', 'PHEV'],
        ]);
    });

    it('recognizes existing electric and hybrid values when editing a legacy vehicle', () => {
        expect(vehicleTypeForFuelType('Electric')).toBe('electric');
        expect(vehicleTypeForFuelType('PHEV')).toBe('phev');
        expect(vehicleTypeForFuelType('Hybrid')).toBe('hybrid');
    });

    it('uses human-readable labels for stored vehicle types', () => {
        expect(vehicleTypeLabelForFuelType('EV')).toBe('Electric');
        expect(vehicleTypeLabelForFuelType('PHEV')).toBe('Plug-in hybrid');
        expect(vehicleTypeLabelForFuelType('Diesel')).toBe('Diesel');
    });
});
