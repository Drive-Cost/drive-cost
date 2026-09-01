export function requirePersistedClientId(clientId: string | undefined, entityName: string): string {
    if (!clientId) {
        throw new Error(`${entityName} is missing its sync client ID.`);
    }
    return clientId;
}
