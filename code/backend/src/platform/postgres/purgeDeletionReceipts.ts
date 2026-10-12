import postgres from 'postgres';

async function purgeExpiredReceipts(): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error('DATABASE_URL is required.');
    const sql = postgres(databaseUrl, { max: 1 });
    try {
        const result = await sql`DELETE FROM account_deletion_receipts WHERE expires_at <= clock_timestamp()`;
        console.info(`Removed ${result.count} expired deletion receipts.`);
    } finally {
        await sql.end();
    }
}
purgeExpiredReceipts().catch(() => {
    console.error('Deletion receipt maintenance failed.');
    process.exitCode = 1;
});
