export const ENTRY_DELETE_FAILURE_MESSAGE = 'Unable to delete this entry.';
export const ENTRY_SAVE_FAILURE_MESSAGE = 'Unable to save this entry.';

export function entryErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}
