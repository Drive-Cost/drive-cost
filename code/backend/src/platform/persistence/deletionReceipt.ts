import type { DeletionReceipt } from '../../types/domain';

// Provisional finite policy; production/privacy approval is required before release.
export const DELETION_RECEIPT_RETENTION_DAYS = 30;
export function createDeletionReceipt(secretHash: string, deletedUserId: string): DeletionReceipt {
    const now = new Date();
    return {
        secretHash,
        deletedUserId,
        completedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + DELETION_RECEIPT_RETENTION_DAYS * 86_400_000).toISOString(),
    };
}
