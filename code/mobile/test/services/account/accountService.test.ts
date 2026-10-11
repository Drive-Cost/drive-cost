import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/database/syncStateRepository', () => ({ getSyncOwner: vi.fn(), bindSyncOwner: vi.fn() }));
vi.mock('../../../src/services/sync/apiClient', () => ({
  apiClient: { login: vi.fn(), logout: vi.fn(), register: vi.fn(), upgrade: vi.fn() },
}));
vi.mock('../../../src/services/sync/authSession', () => ({ getMobileSession: vi.fn(), persistMobileSession: vi.fn() }));

import { getSyncOwner, bindSyncOwner } from '../../../src/database/syncStateRepository';
import { apiClient } from '../../../src/services/sync/apiClient';
import { getMobileSession, persistMobileSession } from '../../../src/services/sync/authSession';
import { createAccount, signIn } from '../../../src/services/account/accountService';

const response = {
  accessToken: 'access',
  refreshToken: 'refresh',
  accessTokenExpiresAt: '2026-10-09T12:00:00.000Z',
  user: { id: 'user_1', mode: 'registered' as const },
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getSyncOwner).mockResolvedValue({ userId: 'user_1', mode: 'registered' });
  vi.mocked(apiClient.login).mockResolvedValue(response);
  vi.mocked(apiClient.register).mockResolvedValue(response);
  vi.mocked(apiClient.upgrade).mockResolvedValue(response);
  vi.mocked(persistMobileSession).mockResolvedValue({
    userId: 'user_1',
    mode: 'registered',
    accessToken: 'access',
    refreshToken: 'refresh',
    accessTokenExpiresAt: response.accessTokenExpiresAt,
  });
});

describe('account use cases', () => {
  it('does not sign an unbound local dataset into an existing account', async () => {
    vi.mocked(getSyncOwner).mockResolvedValue(null);
    await expect(signIn('me@example.com', 'password')).rejects.toThrow('Choose how to use it');
    expect(apiClient.login).not.toHaveBeenCalled();
  });

  it('cleans up a mismatched login without persisting it or changing the owner', async () => {
    vi.mocked(getSyncOwner).mockResolvedValue({ userId: 'other_user', mode: 'registered' });
    await expect(signIn('me@example.com', 'password')).rejects.toThrow('linked to another account');
    expect(apiClient.logout).toHaveBeenCalledWith(response.refreshToken);
    expect(persistMobileSession).not.toHaveBeenCalled();
    expect(bindSyncOwner).not.toHaveBeenCalled();
  });

  it('persists only a login matching the dataset owner', async () => {
    await signIn(' me@example.com ', 'password');
    expect(apiClient.login).toHaveBeenCalledWith('me@example.com', 'password');
    expect(persistMobileSession).toHaveBeenCalledWith(response);
  });

  it('upgrades a current guest account rather than registering a replacement identity', async () => {
    vi.mocked(getSyncOwner).mockResolvedValue({ userId: 'user_1', mode: 'guest' });
    vi.mocked(getMobileSession).mockReturnValue({
      userId: 'user_1',
      mode: 'guest',
      accessToken: 'access',
      refreshToken: 'refresh',
      accessTokenExpiresAt: response.accessTokenExpiresAt,
    });
    await createAccount(' me@example.com ', 'password');
    expect(apiClient.upgrade).toHaveBeenCalledWith('me@example.com', 'password');
    expect(apiClient.register).not.toHaveBeenCalled();
    expect(bindSyncOwner).toHaveBeenCalledWith({ userId: 'user_1', mode: 'registered' });
  });

  it('binds a previously local dataset to the newly created account', async () => {
    vi.mocked(getSyncOwner).mockResolvedValue(null);
    await createAccount('me@example.com', 'password');
    expect(apiClient.register).toHaveBeenCalled();
    expect(bindSyncOwner).toHaveBeenCalledWith({ userId: 'user_1', mode: 'registered' });
  });
  it('requires the bound guest identity before upgrading and never registers a replacement', async () => {
    vi.mocked(getSyncOwner).mockResolvedValue({ userId: 'user_1', mode: 'guest' });
    await expect(createAccount('me@example.com', 'password')).rejects.toThrow('Sign in');
    expect(apiClient.register).not.toHaveBeenCalled();
    expect(apiClient.upgrade).not.toHaveBeenCalled();
  });

  it('rejects a mismatched upgrade response without rebinding local data', async () => {
    vi.mocked(getSyncOwner).mockResolvedValue({ userId: 'user_1', mode: 'guest' });
    vi.mocked(getMobileSession).mockReturnValue({
      userId: 'user_1',
      mode: 'guest',
      accessToken: 'access',
      refreshToken: 'refresh',
      accessTokenExpiresAt: response.accessTokenExpiresAt,
    });
    vi.mocked(apiClient.upgrade).mockResolvedValue({ ...response, user: { id: 'other', mode: 'registered' } });
    await expect(createAccount('me@example.com', 'password')).rejects.toThrow('linked to another account');
    expect(persistMobileSession).not.toHaveBeenCalled();
    expect(bindSyncOwner).not.toHaveBeenCalled();
  });

  it('does not publish authentication if the owner binding fails', async () => {
    vi.mocked(getSyncOwner).mockResolvedValue(null);
    vi.mocked(bindSyncOwner).mockRejectedValue(new Error('Storage failure'));
    await expect(createAccount('me@example.com', 'password')).rejects.toThrow('Storage failure');
    expect(persistMobileSession).not.toHaveBeenCalled();
  });
});
