import { db } from '../../database/db';
import { getAccountAdoptionJobs, acknowledgeAccountAdoption } from '../../database/accountDataRepository';
import { apiClient } from '../sync/apiClient';
import { canSyncOwner } from '../sync/syncAccess';
import { decodeAccountEntity } from './adoptionPolicy';
import { AccountDataError } from './accountErrors';

/** Establish adopted identities without overwriting cloud content, before normal push/pull. */
export async function pushAdoptedData(ownerId: string): Promise<boolean> {
  for (const job of await getAccountAdoptionJobs()) {
    if (job.ownerId !== ownerId) throw new AccountDataError('These device changes belong to another account.');
    if (!(await canSyncOwner(ownerId))) return false;
    const entity = decodeAccountEntity(job.entityType, job.payload);
    if (entity.payload.clientId !== job.clientId || !Number.isSafeInteger(job.cutoffJobId) || job.cutoffJobId < 0) {
      throw new AccountDataError('Some device changes cannot be added safely. Your device records are preserved.');
    }
    await apiClient.createAdoptedEntity(entity.entityType, entity.payload);
    if (!(await canSyncOwner(ownerId))) return false;
    await db.withExclusiveTransactionAsync(async transaction => {
      if (!(await canSyncOwner(ownerId, transaction))) throw new AccountDataError('Sign in to resume sync.');
      await acknowledgeAccountAdoption(job, transaction);
    });
  }
  return true;
}
