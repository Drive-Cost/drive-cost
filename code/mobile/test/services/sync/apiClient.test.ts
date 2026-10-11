import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { SyncEntity, SyncOperation } from '../../../src/domain/sync';
import type { PullResponse, SessionResponse } from '../../../src/domain/sync';

const validSession = {
  accessToken: 'access',
  refreshToken: 'refresh',
  accessTokenExpiresAt: '2026-10-09T12:00:00.000Z',
  user: { id: 'user_1', mode: 'registered', email: 'me@example.com' },
};

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'https://api.drivecost.test');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function clientReturning(body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })));
  return (await import('../../../src/services/sync/apiClient')).apiClient;
}

describe('session response validation', () => {
  it('retains the verified user identity and optional email', async () => {
    const client = await clientReturning(validSession);
    expectTypeOf(client.login).returns.toEqualTypeOf<Promise<SessionResponse>>();
    expect(await client.login('me@example.com', 'a long password')).toEqual(validSession);
  });

  it('constructs a session DTO without carrying unrelated server fields', async () => {
    const client = await clientReturning({
      ...validSession,
      debug: true,
      user: { ...validSession.user, passwordHash: 'private' },
    });
    expect(await client.login('me@example.com', 'a long password')).toEqual(validSession);
  });

  it('returns a validated pull DTO with a cursor matching its ordered changes', async () => {
    const response = {
      data: [
        {
          sequence: 1,
          entityType: SyncEntity.Vehicle,
          operation: SyncOperation.Delete,
          payload: { clientId: 'vehicle_1' },
        },
      ],
      nextCursor: 1,
    };
    const client = await clientReturning(response);
    expectTypeOf(client.pullChanges).returns.toEqualTypeOf<Promise<PullResponse>>();
    expect(await client.pullChanges(0)).toEqual(response);
  });

  it.each([
    { data: [], nextCursor: 5 },
    { data: 'invalid', nextCursor: 0 },
    {
      data: [{ sequence: 1, entityType: 'vehicle', operation: 'delete', payload: { clientId: 'vehicle_1' } }],
      nextCursor: 2,
    },
  ])('rejects malformed pull responses at the HTTP boundary %#', async body => {
    const client = await clientReturning(body);
    await expect(client.pullChanges(0)).rejects.toThrow();
  });

  it('exposes successful mutation acknowledgement as void, including empty 204 responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    const client = (await import('../../../src/services/sync/apiClient')).apiClient;
    expectTypeOf(client.sync).returns.toEqualTypeOf<Promise<void>>();
    await expect(
      client.sync(SyncEntity.Vehicle, SyncOperation.Delete, { clientId: 'vehicle_1' })
    ).resolves.toBeUndefined();
  });

  it.each([
    { ...validSession, user: undefined },
    { ...validSession, user: null },
    { ...validSession, user: { id: 'user_1' } },
    { ...validSession, user: { id: '', mode: 'registered' } },
    { ...validSession, user: { id: 'user_1', mode: 'admin' } },
    { ...validSession, user: { id: 'user_1', mode: 'registered', email: 123 } },
    { ...validSession, accessToken: '' },
    { ...validSession, refreshToken: '' },
    { ...validSession, accessTokenExpiresAt: 'not a date' },
  ])('rejects incomplete or malformed session data %#', async response => {
    const client = await clientReturning(response);
    await expect(client.login('me@example.com', 'a long password')).rejects.toThrow('invalid session response');
  });
  it('pulls maintenance whose optional description is empty, matching the accepted local and HTTP input', async () => {
    const body = {
      data: [
        {
          sequence: 1,
          entityType: 'maintenance_entry',
          operation: 'upsert',
          payload: {
            clientId: 'service-1',
            vehicleClientId: 'vehicle-1',
            type: 'Service',
            description: '',
            cost: 100,
            odometer: 1000,
            date: '2026-10-11T00:00:00.000Z',
          },
        },
      ],
      nextCursor: 1,
    };
    const client = await clientReturning(body);
    await expect(client.pullChanges(0)).resolves.toEqual(body);
  });

  it('preflights a temporary account with its token without activating it or refreshing another session', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ data: [], nextCursor: 0 }), {
            status: 200,
            headers: { 'x-drivecost-adoption': 'create-only-v1' },
          })
        )
    );
    const client = (await import('../../../src/services/sync/apiClient')).apiClient;
    const refresh = vi.fn();
    client.setRefreshHandler(refresh);
    client.setAccessToken('current-account');
    await client.pullAccountChanges(0, 'temporary-account', true);
    expect(vi.mocked(fetch).mock.calls[0][1]?.headers).toEqual({ Authorization: 'Bearer temporary-account' });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('rejects adoption preflight against a backend without the create-only guarantee', async () => {
    const client = await clientReturning({ data: [], nextCursor: 0 });
    await expect(client.pullAccountChanges(0, 'temporary-account', true)).rejects.toThrow('not available yet');
    expect(client.hasSession()).toBe(false);
  });

  it('marks only adopted bootstrap uploads as create-only', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    const client = (await import('../../../src/services/sync/apiClient')).apiClient;
    const payload = {
      clientId: 'vehicle-1',
      brand: 'Toyota',
      model: 'Corolla',
      year: 2022,
      ownershipStartMileage: 1000,
      trackingStartMileage: 1000,
      currentOdometer: 1000,
    };
    await client.createAdoptedEntity('vehicle', payload);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('https://api.drivecost.test/vehicles/adoption');
    expect(vi.mocked(fetch).mock.calls[0][1]?.headers).toMatchObject({ 'x-drivecost-adoption': 'create-only-v1' });
  });
});
