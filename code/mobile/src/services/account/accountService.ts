import { bindSyncOwner, getSyncOwner } from '../../database/syncStateRepository';
import { apiClient } from '../sync/apiClient';
import { getMobileSession, persistMobileSession } from '../sync/authSession';

export class AccountOwnershipError extends Error {}

// These use cases preserve the dataset's existing owner; sync remains optional.
export async function signIn(email: string, password: string): Promise<void> {
  const owner = await getSyncOwner();
  if (!owner) {
    throw new AccountOwnershipError(
      'This device already contains DriveCost data. Choose how to use it with an account in a future update.'
    );
  }
  const response = await apiClient.login(email.trim(), password);
  if (response.user.id !== owner.userId) {
    await apiClient.logout(response.refreshToken);
    throw new AccountOwnershipError('This device contains DriveCost data linked to another account.');
  }
  await bindSyncOwner({ userId: response.user.id, mode: response.user.mode });
  await persistMobileSession(response);
}

export async function createAccount(email: string, password: string): Promise<void> {
  const owner = await getSyncOwner();
  const current = getMobileSession();
  if (owner && (owner.mode !== 'guest' || current?.mode !== 'guest' || current.userId !== owner.userId)) {
    throw new AccountOwnershipError('Sign in to the account linked to this device before creating an account.');
  }
  const response = owner
    ? await apiClient.upgrade(email.trim(), password)
    : await apiClient.register(email.trim(), password);
  if (owner && response.user.id !== owner.userId) {
    await apiClient.logout(response.refreshToken);
    throw new AccountOwnershipError('This device contains DriveCost data linked to another account.');
  }
  await bindSyncOwner({ userId: response.user.id, mode: response.user.mode });
  await persistMobileSession(response);
}
