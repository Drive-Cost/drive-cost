import { decodePullResponse, RemoteChange } from '../../../domain/sync';

export interface PullSyncDependencies<Transaction> {
    getCursor: () => Promise<number>;
    pullChanges: (after: number) => Promise<unknown>;
    withTransaction: (operation: (transaction: Transaction) => Promise<void>) => Promise<void>;
    applyChange: (change: RemoteChange, transaction: Transaction) => Promise<void>;
    setCursor: (cursor: number, transaction: Transaction) => Promise<void>;
}

export async function reconcilePulledChanges<Transaction>(
    dependencies: PullSyncDependencies<Transaction>,
): Promise<number> {
    let cursor = await dependencies.getCursor();
    let appliedChanges = 0;

    for (;;) {
        const response = decodePullResponse(await dependencies.pullChanges(cursor), cursor);

        if (response.data.length === 0) {
            return appliedChanges;
        }

        await dependencies.withTransaction(async (transaction) => {
            for (const change of response.data) {
                await dependencies.applyChange(change, transaction);
            }
            await dependencies.setCursor(response.nextCursor, transaction);
        });

        cursor = response.nextCursor;
        appliedChanges += response.data.length;
    }
}
