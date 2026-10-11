import { describe, expect, it } from 'vitest';
import { initialState as chargingState, reduce as reduceCharge } from '../../src/screens/Charging/reducer';
import { initialState as odometerState, reduce as reduceOdometer } from '../../src/screens/UpdateOdometer/reducer';
import { initialState as newVehicleState, reduce as reduceNewVehicle } from '../../src/screens/AddVehicle/reducer';
import { initialState as vehicleState, reduce as reduceVehicle } from '../../src/screens/EditVehicle/reducer';
import { initialState as signInState, reduce as reduceSignIn } from '../../src/screens/SignIn/reducer';

type LifecycleAction = { type: 'save' } | { type: 'saved' } | { type: 'error'; message: string };

function expectSaveLifecycle<State extends { tag: 'editing' | 'saving' | 'saved' }>(
    reduce: (state: State, action: LifecycleAction) => State,
    initial: State,
) {
    expect(reduce(initial, { type: 'saved' })).toBe(initial);
    const saving = reduce(initial, { type: 'save' });
    expect(saving.tag).toBe('saving');
    expect(reduce(saving, { type: 'save' })).toBe(saving);
    expect(reduce(saving, { type: 'error', message: 'Try again.' })).toEqual({ ...initial, error: 'Try again.' });
    const completed = reduce(saving, { type: 'saved' });
    expect(completed.tag).toBe('saved');
    expect(reduce(completed, { type: 'error', message: 'late error' })).toBe(completed);
}

const vehicleInput = {
    brand: 'Toyota',
    model: 'Corolla',
    year: '2022',
    label: '',
    fuelType: 'Petrol',
    engine: '',
    powerHp: '',
    transmission: '',
    ownershipStartMileage: '100',
    trackingStartMileage: '200',
    trackingStartDate: '2026-10-11',
    currentOdometer: '300',
};

describe('screen-owned submission reducers', () => {
    it('preserves charging input on failure and rejects edits during saving', () => {
        const initial = chargingState({ date: '2026-10-11', kWh: '20', price: '10', odometer: '300' });
        expectSaveLifecycle(reduceCharge, initial);
        const saving = reduceCharge(initial, { type: 'save' });
        expect(reduceCharge(saving, { type: 'change', field: 'price', value: '100' })).toBe(saving);
        const failed = reduceCharge(saving, { type: 'error', message: 'Failed' });
        expect(reduceCharge(failed, { type: 'change', field: 'price', value: '12' })).toMatchObject({
            error: null,
            form: { price: '12' },
        });
    });

    it('preserves odometer input and allows retry after a failure', () => {
        const initial = odometerState('300');
        expectSaveLifecycle(reduceOdometer, initial);
        const saving = reduceOdometer(initial, { type: 'save' });
        expect(reduceOdometer(saving, { type: 'change', value: '1' })).toBe(saving);
    });

    it('preserves creation input and rejects concurrent edits', () => {
        const initial = reduceNewVehicle(newVehicleState(), { type: 'change', field: 'brand', value: 'Toyota' });
        expectSaveLifecycle(reduceNewVehicle, initial);
        const saving = reduceNewVehicle(initial, { type: 'save' });
        expect(reduceNewVehicle(saving, { type: 'change', field: 'brand', value: 'Changed' })).toBe(saving);
    });

    it('preserves the complete vehicle profile when saving fails', () => {
        const initial = vehicleState(vehicleInput);
        expectSaveLifecycle(reduceVehicle, initial);
        const saving = reduceVehicle(initial, { type: 'save' });
        expect(reduceVehicle(saving, { type: 'change', field: 'trackingStartMileage', value: '0' })).toBe(saving);
    });

    it('keeps sign-in fields separate from account-creation confirmation', () => {
        const initial = signInState();
        expect(initial.input).toEqual({ email: '', password: '' });
        const edited = reduceSignIn(initial, { type: 'edit', field: 'password', value: 'a long password' });
        const submitting = reduceSignIn(edited, { type: 'submit' });
        expect(reduceSignIn(submitting, { type: 'edit', field: 'password', value: 'changed' })).toBe(submitting);
        expect(reduceSignIn(submitting, { type: 'error', message: 'Try again.' })).toMatchObject({
            tag: 'editing',
            input: { password: 'a long password' },
        });
        expect(reduceSignIn(submitting, { type: 'success' })).toMatchObject({
            tag: 'succeeded',
            input: { password: '' },
        });
    });
});
