import { describe, expect, it } from 'vitest';
import { getGarageVehiclePresentation } from '../../../src/services/vehicle/garageVehiclePresentation';

const vehicle = {
    id: 7,
    brand: 'Audi',
    model: 'A4',
    year: 2002,
    fuelType: 'Diesel',
    ownershipStartMileage: 10_000,
    trackingStartMileage: 20_000,
    trackingStartDate: '2026-01-01',
    currentOdometer: 372_450,
};

describe('Garage vehicle presentation', () => {
    it('uses a meaningful custom label, readable type, and concise odometer', () => {
        expect(getGarageVehiclePresentation({ ...vehicle, label: 'Weekend car', fuelType: 'EV' }, 1)).toEqual({
            name: 'Weekend car',
            context: '2002 · Electric',
            odometer: '372,450 km',
            isActive: false,
            showsSetActive: true,
        });
    });

    it('uses brand and model when a label merely repeats vehicle identity', () => {
        expect(getGarageVehiclePresentation({ ...vehicle, label: 'Audi A4' }, 7)).toMatchObject({
            name: 'Audi A4',
            context: '2002 · Diesel',
            isActive: true,
            showsSetActive: false,
        });
    });

    it('does not duplicate identical brand and model values or expose tracking fields', () => {
        const presentation = getGarageVehiclePresentation({ ...vehicle, brand: 'A', model: 'A', label: undefined }, null);

        expect(presentation.name).toBe('A');
        expect(presentation).not.toHaveProperty('ownershipStartMileage');
        expect(presentation).not.toHaveProperty('trackingStartMileage');
        expect(presentation).not.toHaveProperty('trackingStartDate');
    });

    it('omits malformed secondary metadata instead of exposing a raw value', () => {
        expect(getGarageVehiclePresentation({ ...vehicle, year: 0, fuelType: 'undefined' }, null).context).toBeUndefined();
        expect(getGarageVehiclePresentation({ ...vehicle, year: 0, fuelType: '·' }, null).context).toBeUndefined();
        expect(getGarageVehiclePresentation({ ...vehicle, year: 2002, fuelType: '·' }, null).context).toBe('2002');
        expect(getGarageVehiclePresentation({ ...vehicle, year: 0, fuelType: 'EV' }, null).context).toBe('Electric');
    });

    it('presents multiple vehicles independently', () => {
        const active = getGarageVehiclePresentation(vehicle, 7);
        const other = getGarageVehiclePresentation({ ...vehicle, id: 8, brand: 'Toyota', model: 'Corolla', currentOdometer: 10_200 }, 7);

        expect(active).toMatchObject({ name: 'Audi A4', isActive: true, showsSetActive: false });
        expect(other).toMatchObject({ name: 'Toyota Corolla', odometer: '10,200 km', isActive: false, showsSetActive: true });
    });
});
