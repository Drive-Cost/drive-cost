import {
  assertAccountContext,
  getDatasetGeneration,
  isDatasetCurrent,
  assertDatasetCurrent,
} from '../app/datasetContext';
import { requireAccountLifecycleAvailable } from '../../database/syncStateRepository';
import { db } from '../../database/db';
import {
  readAccountDataset,
  resetAccountDataset,
  bindAccountDataset,
  queueAccountAdoption,
} from '../../database/accountDataRepository';
import type { AccountDataset } from '../../database/accountDataRepository';
import { bindSyncOwner, getSyncOwner, setSessionBlocked } from '../../database/syncStateRepository';
import type { SessionResponse, RemoteChange } from '../../domain/sync';
import { apiClient, SyncApiError } from '../sync/apiClient';
import { clearSignedOutSession, getMobileSession, persistMobileSession } from '../sync/authSession';
import { showSignedOut } from '../sync/syncService';
import { applyChange } from '../sync/pullSync/pullSync';
import { assertSafeAdoption } from './adoptionPolicy';
import { AccountActivationError, AccountDataError, AccountOwnershipError } from './accountErrors';
import { useVehicleStore } from '../../store/vehicleStore';
import { useFuelStore } from '../../store/fuelStore';
import { useChargingStore } from '../../store/chargingStore';
import { useMaintenanceStore } from '../../store/maintenanceStore';
import { useExpenseStore } from '../../store/expenseStore';
import { useRecurringExpenseStore } from '../../store/recurringExpenseStore';

export type SignInResult =
  | { tag: 'signed-in' }
  | {
      tag: 'choose-data';
      attemptId: number;
      email: string;
      vehicleCount: number;
      recordCount: number;
    };
export type AccountDataChoice = { kind: 'add' } | { kind: 'replace'; confirmed: true };

type PendingSignIn = {
  id: number;
  generation: number;
  response: SessionResponse;
  dataset: AccountDataset;
  stage: 'choosing' | 'committed' | 'activated';
  cancelled: boolean;
  working: boolean;
  decision: AccountDataChoice | null;
};
let attempt = 0;
let pending: PendingSignIn | null = null;

const mismatchMessage = 'This device contains DriveCost data linked to another account.';
function revoke(response: Pick<SessionResponse, 'refreshToken'>) {
  void apiClient.logout(response.refreshToken).catch(() => undefined);
}
function assertCurrent(choice: PendingSignIn) {
  assertAccountContext();
  if (!isDatasetCurrent(choice.generation) || choice.cancelled || pending !== choice)
    throw new AccountDataError('Sign-in was cancelled. Your device data is safe.');
}

export async function signIn(email: string, password: string, signal?: AbortSignal): Promise<SignInResult> {
  assertAccountContext();
  await requireAccountLifecycleAvailable();
  if (pending) cancelSignIn(pending.id);
  const generation = getDatasetGeneration();
  const id = ++attempt;
  const onAbort = () => {
    if (attempt === id) attempt += 1;
    cancelSignIn(id);
  };
  signal?.addEventListener('abort', onAbort, { once: true });
  let response: SessionResponse;
  try {
    response = await apiClient.login(email.trim(), password);
  } catch (error) {
    signal?.removeEventListener('abort', onAbort);
    throw error;
  }
  if (!isDatasetCurrent(generation) || id !== attempt || signal?.aborted) {
    signal?.removeEventListener('abort', onAbort);
    revoke(response);
    throw new AccountDataError('Sign-in was cancelled.');
  }
  if (response.user.mode !== 'registered') {
    signal?.removeEventListener('abort', onAbort);
    revoke(response);
    throw new AccountOwnershipError('Use a registered DriveCost account to sign in.');
  }
  let dataset: AccountDataset | undefined;
  try {
    await db.withExclusiveTransactionAsync(async transaction => {
      assertAccountContext();
      await requireAccountLifecycleAvailable(transaction);
      dataset = await readAccountDataset(transaction);
    });
    if (id !== attempt || signal?.aborted) throw new AccountDataError('Sign-in was cancelled.');
    if (!dataset) throw new AccountDataError('Unable to read device data. Please try again.');
    if (dataset.owner) {
      if (dataset.owner.userId !== response.user.id) throw new AccountOwnershipError(mismatchMessage);
      await db.withExclusiveTransactionAsync(async transaction => {
        const owner = await getSyncOwner(transaction);
        if (id !== attempt || signal?.aborted) throw new AccountDataError('Sign-in was cancelled.');
        if (owner?.userId !== response.user.id) throw new AccountOwnershipError(mismatchMessage);
        await bindSyncOwner({ userId: response.user.id, mode: response.user.mode }, transaction);
        await setSessionBlocked(true, transaction);
      });
      if (id !== attempt || signal?.aborted) throw new AccountDataError('Sign-in was cancelled.');
      await activate(response, undefined, generation);
      return { tag: 'signed-in' };
    }
    pending = {
      id,
      generation,
      response,
      dataset,
      cancelled: false,
      stage: 'choosing',
      working: false,
      decision: null,
    };
    if (dataset.entities.length === 0 && dataset.pending.length === 0) {
      await confirmAccountDataChoice(id, { kind: 'replace', confirmed: true });
      return { tag: 'signed-in' };
    }
    return {
      tag: 'choose-data',
      attemptId: id,
      email: response.user.email ?? email.trim(),
      vehicleCount: dataset.vehicleIds.length,
      recordCount: dataset.entities.length,
    };
  } catch (error) {
    if (!pending || pending.id !== id || pending.stage === 'choosing') revoke(response);
    throw error;
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
}

async function activate(
  response: SessionResponse,
  choice?: PendingSignIn,
  generation = choice?.generation ?? getDatasetGeneration()
): Promise<void> {
  assertAccountContext();
  await requireAccountLifecycleAvailable();
  assertAccountContext();
  assertDatasetCurrent(generation);
  if (choice) assertCurrent(choice);
  await persistMobileSession(response);
  assertDatasetCurrent(generation);
  await db.withExclusiveTransactionAsync(async transaction => {
    assertDatasetCurrent(generation);
    if (choice) assertCurrent(choice);
    if ((await getSyncOwner(transaction))?.userId !== response.user.id)
      throw new AccountOwnershipError(mismatchMessage);
    await setSessionBlocked(false, transaction);
  });
}

async function fetchAccountData(
  choice: PendingSignIn,
  adoption: boolean
): Promise<{ changes: RemoteChange[]; cursor: number }> {
  const changes: RemoteChange[] = [];
  let cursor = 0;
  for (;;) {
    assertCurrent(choice);
    const page = await apiClient.pullAccountChanges(cursor, choice.response.accessToken, adoption);
    assertCurrent(choice);
    if (page.data.length === 0) return { changes, cursor };
    changes.push(...page.data);
    cursor = page.nextCursor;
  }
}

export async function confirmAccountDataChoice(id: number, decision: AccountDataChoice): Promise<void> {
  const choice = pending;
  if (!choice || choice.id !== id) throw new AccountDataError('Sign in again to choose your device data.');
  if (choice.working) throw new AccountDataError('Your data choice is already being saved.');
  if (decision.kind === 'replace' && decision.confirmed !== true)
    throw new AccountDataError('Confirm replacement before removing device data.');
  if (choice.stage !== 'choosing' && choice.decision?.kind !== decision.kind) {
    throw new AccountActivationError('Your data choice is already saved. Retry connecting this account.');
  }
  choice.working = true;
  try {
    assertCurrent(choice);
    if (choice.stage === 'choosing') {
      const remote = await fetchAccountData(choice, decision.kind === 'add');
      if (decision.kind === 'add') assertSafeAdoption(choice.dataset, remote.changes);
      await db.withExclusiveTransactionAsync(async transaction => {
        assertCurrent(choice);
        const current = await readAccountDataset(transaction);
        if (current.owner || current.signature !== choice.dataset.signature) {
          throw new AccountDataError('Device records changed. Cancel and sign in again to review your data choice.');
        }
        if (decision.kind === 'replace') await resetAccountDataset(transaction);
        else await queueAccountAdoption(current, choice.response.user.id, transaction);
        for (const change of remote.changes) await applyChange(change, transaction);
        await bindAccountDataset({ userId: choice.response.user.id, mode: 'registered' }, remote.cursor, transaction);
        assertCurrent(choice);
      });
      choice.decision = decision;
      choice.stage = 'committed';
    }
    // SecureStore cannot share a SQLite transaction. A blocked binding survives
    // interrupted activation and permits only this account to recover it.
    if (choice.stage === 'committed') {
      await activate(choice.response, choice);
      choice.stage = 'activated';
    }
    await refreshAccountData(choice.dataset.vehicleIds);
    if (pending === choice) pending = null;
  } catch (error) {
    if (error instanceof AccountOwnershipError) throw error;
    if (choice.stage === 'choosing' && error instanceof SyncApiError && error.status === 401) {
      throw new AccountDataError('This sign-in has expired. Cancel and sign in again. Your device data is unchanged.');
    }
    if (choice.stage !== 'choosing')
      throw new AccountActivationError(
        'Your data choice is saved. Please try again to finish connecting this account.'
      );
    throw new AccountDataError(
      'Account data could not be downloaded. Your device data is unchanged. Please try again.'
    );
  } finally {
    choice.working = false;
  }
}

export function cancelSignIn(id: number): void {
  const choice = pending;
  if (!choice || choice.id !== id || choice.stage !== 'choosing') return;
  choice.cancelled = true;
  pending = null;
  attempt += 1;
  revoke(choice.response);
}

export async function signOut(): Promise<void> {
  assertAccountContext();
  await requireAccountLifecycleAvailable();
  const owner = await getSyncOwner();
  if (!owner || owner.mode !== 'registered')
    throw new AccountOwnershipError('Sign out is available for your registered account.');
  const current = getMobileSession();
  // Persist intent first, so interrupted secure-storage deletion cannot restore
  // authenticated sync on restart. Business data, jobs and cursors are untouched.
  await setSessionBlocked(true);
  try {
    await clearSignedOutSession();
  } finally {
    showSignedOut();
    if (current) revoke(current);
  }
}

async function refreshAccountData(previousVehicleIds: number[]): Promise<void> {
  await useVehicleStore.getState().loadVehicles();
  const ids = new Set([...previousVehicleIds, ...useVehicleStore.getState().vehicles.map(vehicle => vehicle.id)]);
  for (const id of ids) {
    await Promise.all([
      useFuelStore.getState().loadFuelEntries(id),
      useChargingStore.getState().loadChargingEntries(id),
      useMaintenanceStore.getState().loadMaintenanceEntries(id),
      useExpenseStore.getState().loadExpenseEntries(id),
      useRecurringExpenseStore.getState().loadRecurringExpenses(id),
    ]);
  }
}
