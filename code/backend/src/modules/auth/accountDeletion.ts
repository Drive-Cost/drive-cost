import { createHash, timingSafeEqual } from 'node:crypto';
import type { AccountDeletionRequest, AccountDeletionStatus, CompletedAccountDeletion } from '@drivecost/contracts';
import type { DriveCostRepository } from '../../platform/persistence/repository';
import { Problems } from '../../platform/http/problemDetails';
import type { AuthenticatedUser, DeletionReceipt } from '../../types/domain';
import { verifyPassword } from './passwords';
import { parseRefreshCredential } from './sessions';

export function createAccountDeletionService(repository: DriveCostRepository) {
    return {
        async deleteAccount(
            identity: AuthenticatedUser,
            input: AccountDeletionRequest
        ): Promise<CompletedAccountDeletion> {
            const receipt = await repository.deleteAccount(
                identity.sub,
                identity.sid,
                hashDeletionSecret(input.operationSecret),
                async (user, session) => {
                    // Persisted mode is authoritative, including for pre-upgrade guest JWTs.
                    if (user.mode === 'registered') {
                        if (
                            !input.password ||
                            !user.passwordHash ||
                            !(await verifyPassword(input.password, user.passwordHash))
                        ) {
                            throw Problems.deletionConfirmationFailed();
                        }
                    } else {
                        const credential = input.refreshToken ? parseRefreshCredential(input.refreshToken) : null;
                        if (
                            !credential ||
                            credential.sessionId !== session.id ||
                            !sameHash(credential.refreshTokenHash, session.refreshTokenHash)
                        ) {
                            throw Problems.deletionConfirmationFailed();
                        }
                    }
                }
            );
            return completed(receipt);
        },
        async status(operationSecret: string): Promise<AccountDeletionStatus> {
            const receipt = await repository.findDeletionReceipt(hashDeletionSecret(operationSecret));
            return receipt ? completed(receipt) : { status: 'unknown' };
        },
    };
}

export function hashDeletionSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
}
function sameHash(left: string, right: string): boolean {
    const a = Buffer.from(left, 'utf8');
    const b = Buffer.from(right, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
}
function completed(receipt: DeletionReceipt): CompletedAccountDeletion {
    return { status: 'completed', deletedUserId: receipt.deletedUserId, completedAt: receipt.completedAt };
}
