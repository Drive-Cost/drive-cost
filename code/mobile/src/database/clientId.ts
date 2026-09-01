export function requirePersistedClientId(clientId: string | undefined, entityName: string): string {
    if (!clientId) {
        throw new Error(`${entityName} is missing its sync client ID.`);
    }
    return clientId;
}

export function requirePersistedLocalId(id: number | undefined, entityName: string): number {
    if (id === undefined) {
        throw new Error(`${entityName} is missing its local ID.`);
    }
    return id;
}
