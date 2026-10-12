import * as SecureStore from 'expo-secure-store';
import type { AccountDeletionStatus } from '@drivecost/contracts';
import { db } from '../../database/db';
import {
  clearDeletedDataset,
  deletionDatasetSignature,
  readDeletionIntent,
  removeDeletionIntent,
  writeDeletionIntent,
} from '../../database/accountDeletionRepository';
import type { DeletionIntent } from '../../database/accountDeletionRepository';
import { getSyncOwner, getAccountLifecycleBlock, setSessionBlocked } from '../../database/syncStateRepository';
import { apiClient, SyncApiError } from '../sync/apiClient';
import {
  clearSignedOutSession,
  completeAccountDeletion,
  getMobileSession,
  getMobileSessionState,
  initializeAuthSession,
  pauseAccountSession,
  pauseCurrentSessionForDeletion,
} from '../sync/authSession';
import {
  blockDatasetWrites,
  beginDatasetReset,
  finishDatasetReset,
  releaseAccountContext,
} from '../app/datasetContext';
import { useAccountDeletionStore } from '../../store/accountDeletionStore';
import type { DeletionView } from '../../store/accountDeletionStore';
import { useVehicleStore } from '../../store/vehicleStore';
import { useFuelStore } from '../../store/fuelStore';
import { useChargingStore } from '../../store/chargingStore';
import { useMaintenanceStore } from '../../store/maintenanceStore';
import { useExpenseStore } from '../../store/expenseStore';
import { useRecurringExpenseStore } from '../../store/recurringExpenseStore';
import { showAccountDeletion, showLocalOnly } from '../sync/syncService';

export class AccountDeletionError extends Error {}

const secretKey = 'drivecost.account-deletion.v1';
const secretPattern = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
let active: Promise<DeletionView> | null = null;
function publish(view: DeletionView): DeletionView {
  useAccountDeletionStore.setState({ view });
  return view;
}
function singleOperation(operation: () => Promise<DeletionView>): Promise<DeletionView> {
  if (!active)
    active = Promise.resolve()
      .then(operation)
      .finally(() => {
        active = null;
      });
  return active;
}
async function recoverySecret(intent: DeletionIntent): Promise<string> {
  const stored = await SecureStore.getItemAsync(secretKey);
  const value: unknown = stored ? JSON.parse(stored) : null;
  if (
    !value ||
    typeof value !== 'object' ||
    !('ownerId' in value) ||
    !('operationSecret' in value) ||
    value.ownerId !== intent.ownerId ||
    typeof value.operationSecret !== 'string' ||
    !secretPattern.test(value.operationSecret)
  ) {
    throw new AccountDeletionError(
      'The saved deletion confirmation is unavailable. Your device records are preserved.'
    );
  }
  return value.operationSecret;
}
function resetStores(): void {
  useVehicleStore.setState({ vehicles: [], activeVehicleId: null });
  useFuelStore.setState({ fuelEntries: [], loadStates: {} });
  useChargingStore.setState({ chargingEntries: [], loadStates: {} });
  useMaintenanceStore.setState({ maintenanceEntries: [], loadStates: {} });
  useExpenseStore.setState({ expenseEntries: [], loadStates: {} });
  useRecurringExpenseStore.setState({ recurringExpenses: [], loadStates: {} });
}
async function finishRejected(): Promise<DeletionView> {
  await SecureStore.deleteItemAsync(secretKey);
  await db.withExclusiveTransactionAsync(async transaction => {
    if ((await readDeletionIntent(transaction))?.phase !== 'rejected')
      throw new AccountDeletionError('Deletion recovery changed.');
    await removeDeletionIntent(transaction);
    await setSessionBlocked(false, transaction);
  });
  releaseAccountContext();
  try {
    await initializeAuthSession();
  } catch {
    /* Credentials remain recoverable on network failure. */
  }
  return readyView();
}
async function readyView(): Promise<DeletionView> {
  const owner = await getSyncOwner();
  const session = getMobileSession();
  if (!owner) return publish({ tag: 'blocked', message: 'There is no cloud account linked to this device.' });
  if ((await getAccountLifecycleBlock()) === 'account-unavailable')
    return publish({
      tag: 'blocked',
      message: 'This account is no longer available. Your records remain on this device.',
    });
  if (session?.userId !== owner.userId || session.mode !== owner.mode || getMobileSessionState() !== 'authenticated') {
    return publish({
      tag: 'blocked',
      message:
        owner.mode === 'guest'
          ? 'This older account needs its original sign-in credential to be deleted. Your records remain on this device.'
          : 'Sign in to the account linked to this device before deleting it.',
    });
  }
  return publish({ tag: 'ready', mode: owner.mode, ...(session.email ? { email: session.email } : {}) });
}
async function cleanup(intent: DeletionIntent, reviewedSignature?: string): Promise<DeletionView> {
  blockDatasetWrites();
  if (intent.phase === 'cleared') beginDatasetReset();
  try {
    if (intent.phase !== 'cleared') {
      let updated = intent;
      let changed: string | null = null;
      await db.withExclusiveTransactionAsync(async transaction => {
        const current = await readDeletionIntent(transaction);
        if (!current || current.ownerId !== intent.ownerId || !current.completedAt)
          throw new AccountDeletionError('Cloud deletion has not been confirmed.');
        const signature = await deletionDatasetSignature(transaction);
        if (signature !== (reviewedSignature ?? current.signature)) {
          changed = signature;
          updated = { ...current, phase: 'confirmed' };
          await writeDeletionIntent(updated, transaction);
          return;
        }
        beginDatasetReset();
        updated = { ...current, signature, phase: 'cleanup' };
        await writeDeletionIntent(updated, transaction);
      });
      if (changed) {
        finishDatasetReset();
        return publish({ tag: 'needs-confirmation', signature: changed });
      }
      intent = updated;
      await db.withExclusiveTransactionAsync(async transaction => {
        const current = await readDeletionIntent(transaction);
        if (!current || current.ownerId !== intent.ownerId)
          throw new AccountDeletionError('Deletion recovery changed.');
        await clearDeletedDataset(current, transaction);
      });
    }
    resetStores();
    await clearSignedOutSession();
    await SecureStore.deleteItemAsync(secretKey);
    await db.withExclusiveTransactionAsync(async transaction => {
      if ((await readDeletionIntent(transaction))?.phase !== 'cleared')
        throw new AccountDeletionError('Device cleanup is incomplete.');
      await removeDeletionIntent(transaction);
      await setSessionBlocked(false, transaction);
    });
    completeAccountDeletion();
    finishDatasetReset();
    showLocalOnly();
    return publish({ tag: 'complete' });
  } catch {
    return publish({
      tag: 'cleanup-pending',
      message: 'Your cloud account has been deleted. Device cleanup could not finish. Please try again.',
    });
  }
}
async function confirmed(intent: DeletionIntent, receipt: AccountDeletionStatus): Promise<DeletionView> {
  if (receipt.status !== 'completed') return publish({ tag: 'unknown' });
  if (receipt.deletedUserId !== intent.ownerId)
    throw new AccountDeletionError('Deletion could not be verified for this device account.');
  const next: DeletionIntent = { ...intent, phase: 'confirmed', completedAt: receipt.completedAt };
  await db.withExclusiveTransactionAsync(async transaction => {
    if (
      (await readDeletionIntent(transaction))?.ownerId !== next.ownerId ||
      (await getSyncOwner(transaction))?.userId !== next.ownerId
    )
      throw new AccountDeletionError('Device account changed.');
    await writeDeletionIntent(next, transaction);
  });
  return cleanup(next);
}

/** Startup never sends a fresh deletion request and never refreshes a fenced identity. */
export function restoreAccountDeletion(): Promise<DeletionView> {
  return singleOperation(async () => {
    try {
      const intent = await readDeletionIntent();
      if (!intent) {
        if ((await getAccountLifecycleBlock()) === 'account-unavailable') {
          pauseAccountSession('account-unavailable');
          return publish({
            tag: 'blocked',
            message: 'This account is no longer available. Your records remain on this device.',
          });
        }
        return useAccountDeletionStore.getState().view;
      }
      pauseAccountSession('deletion-pending');
      showAccountDeletion();
      if (intent.phase === 'unknown') return publish({ tag: 'unknown' });
      if (intent.phase === 'rejected') return finishRejected();
      return cleanup(intent);
    } catch {
      pauseAccountSession('deletion-pending');
      showAccountDeletion();
      return publish({
        tag: 'blocked',
        message: 'Account deletion recovery could not be loaded. Your device records are preserved. Try again.',
      });
    }
  });
}
export async function openAccountDeletion(): Promise<DeletionView> {
  const view = await restoreAccountDeletion();
  return view.tag === 'none' || view.tag === 'ready' || (view.tag === 'complete' && (await getSyncOwner()))
    ? readyView()
    : view;
}

export function deleteAccount(password: string): Promise<DeletionView> {
  return singleOperation(async () => {
    if ((await readDeletionIntent()) || (await getAccountLifecycleBlock()))
      throw new AccountDeletionError('Check the existing deletion in Settings.');
    let approvedSignature = '';
    await db.withExclusiveTransactionAsync(async transaction => {
      approvedSignature = await deletionDatasetSignature(transaction);
    });
    await initializeAuthSession();
    const view = await readyView();
    if (view.tag !== 'ready')
      throw new AccountDeletionError(view.tag === 'blocked' ? view.message : 'Sign in before deleting your account.');
    if (view.mode === 'registered' && (password.length < 12 || password.length > 128))
      throw new AccountDeletionError('Enter your full current password (12–128 characters).');
    const current = await pauseCurrentSessionForDeletion();
    showAccountDeletion();
    let operationSecret = '';
    let intent: DeletionIntent | null = null;
    try {
      if (current.mode === 'registered' && (password.length < 12 || password.length > 128)) {
        throw new AccountDeletionError('Review the current account and password before deleting it.');
      }
      const Crypto = await import('expo-crypto');
      operationSecret = globalThis
        .btoa(String.fromCharCode(...(await Crypto.getRandomBytesAsync(32))))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      await SecureStore.setItemAsync(secretKey, JSON.stringify({ ownerId: current.userId, operationSecret }), {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      await db.withExclusiveTransactionAsync(async transaction => {
        if (
          (await getSyncOwner(transaction))?.userId !== current.userId ||
          (await getAccountLifecycleBlock(transaction))
        )
          throw new AccountDeletionError('Device account changed.');
        intent = { ownerId: current.userId, mode: current.mode, phase: 'unknown', signature: approvedSignature };
        if ((await recoverySecret(intent)) !== operationSecret)
          throw new AccountDeletionError('Deletion confirmation could not be saved.');
        await writeDeletionIntent(intent, transaction);
      });
    } catch {
      try {
        await SecureStore.deleteItemAsync(secretKey);
      } catch {
        /* No deletion request was sent. */
      }
      releaseAccountContext();
      try {
        await initializeAuthSession();
      } catch {
        /* Recoverable credentials are preserved. */
      }
      await readyView().catch(() => undefined);
      throw new AccountDeletionError(
        'Deletion could not be prepared safely. Your records are unchanged. Please try again.'
      );
    }
    if (!intent) throw new AccountDeletionError('Deletion could not be prepared safely.');
    const prepared: DeletionIntent = intent;
    publish({ tag: 'unknown' });
    let receipt: AccountDeletionStatus;
    try {
      receipt = await apiClient.deleteAccount(
        current.mode === 'registered'
          ? { operationSecret, password }
          : { operationSecret, refreshToken: current.refreshToken },
        current.accessToken
      );
    } catch (error) {
      if (
        error instanceof SyncApiError &&
        error.status === 403 &&
        error.problem?.type === 'https://drivecost.app/problems/deletion-confirmation-failed'
      ) {
        await db.withExclusiveTransactionAsync(transaction =>
          writeDeletionIntent({ ...prepared, phase: 'rejected' }, transaction)
        );
        await finishRejected();
        throw new AccountDeletionError(
          current.mode === 'registered'
            ? 'That password did not match. Check your current password and try again.'
            : 'This account credential could not confirm deletion. Your records are unchanged.'
        );
      }
      return publish({ tag: 'unknown' });
    }
    try {
      return await confirmed(intent, receipt);
    } catch {
      return publish({ tag: 'unknown' });
    }
  });
}
export function checkAccountDeletion(): Promise<DeletionView> {
  return singleOperation(async () => {
    const intent = await readDeletionIntent();
    if (!intent) throw new AccountDeletionError('No account deletion is waiting for confirmation.');
    if (intent.phase === 'rejected') return finishRejected();
    if (intent.phase !== 'unknown') return cleanup(intent);
    pauseAccountSession('deletion-pending');
    showAccountDeletion();
    try {
      return await confirmed(intent, await apiClient.deletionStatus(await recoverySecret(intent)));
    } catch {
      return publish({ tag: 'unknown' });
    }
  });
}
export function confirmDeviceCleanup(signature: string): Promise<DeletionView> {
  return singleOperation(async () => {
    const intent = await readDeletionIntent();
    if (!intent || !intent.completedAt || intent.phase === 'unknown' || intent.phase === 'rejected')
      throw new AccountDeletionError('Cloud deletion has not been confirmed.');
    return cleanup(intent, signature);
  });
}
