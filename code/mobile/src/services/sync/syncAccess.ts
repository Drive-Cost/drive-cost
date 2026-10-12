import { isAccountContextBlocked } from '../app/datasetContext';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getSyncOwner, isSessionBlocked } from '../../database/syncStateRepository';
import { getMobileSession, getMobileSessionState } from './authSession';

export async function canSyncOwner(ownerId: string, database?: SQLiteDatabase): Promise<boolean> {
  const owner = await getSyncOwner(database);
  const blocked = await isSessionBlocked(database);
  return (
    !blocked &&
    !isAccountContextBlocked() &&
    owner?.userId === ownerId &&
    getMobileSession()?.userId === ownerId &&
    getMobileSessionState() === 'authenticated'
  );
}
