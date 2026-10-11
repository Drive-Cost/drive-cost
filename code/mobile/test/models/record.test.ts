import { describe, expect, expectTypeOf, it } from 'vitest';
import type { CreateFuelEntryInput, FuelEntry, UpdateFuelEntryInput } from '../../src/models/FuelEntry';
import { decodePersistedRecord } from '../../src/database/clientId';

describe('record contracts', () => {
  it('distinguishes caller creation inputs from persisted identities and update inputs', () => {
    expectTypeOf<FuelEntry['id']>().toEqualTypeOf<number>();
    expectTypeOf<FuelEntry['clientId']>().toEqualTypeOf<string>();
    expectTypeOf<CreateFuelEntryInput>().not.toMatchTypeOf<FuelEntry>();
    expectTypeOf<FuelEntry>().not.toMatchTypeOf<CreateFuelEntryInput>();
    expectTypeOf<UpdateFuelEntryInput['id']>().toEqualTypeOf<number>();
  });

  it('validates an identity before promising a persisted row without changing the IDs', () => {
    expect(decodePersistedRecord({ id: 7, clientId: 'legacy-fuel-7', price: 50 }, 'Fuel entry')).toEqual({
      id: 7,
      clientId: 'legacy-fuel-7',
      price: 50,
    });
    for (const id of [undefined, null, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => decodePersistedRecord({ id, clientId: 'fuel-7' }, 'Fuel entry')).toThrow();
    }
    expect(decodePersistedRecord({ id: -1, clientId: 'legacy-record' }, 'Entry').id).toBe(-1);
    for (const clientId of [undefined, null, '']) {
      expect(() => decodePersistedRecord({ id: 7, clientId }, 'Fuel entry')).toThrow();
    }
  });
});
