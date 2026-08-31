import fs from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

const migrationsDirectory = path.join(process.cwd(), 'migrations');

async function migrate() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error('DATABASE_URL is required to run database migrations.');
    }

    const sql = postgres(databaseUrl, { max: 1 });

    try {
        await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;

        const migrationNames = (await fs.readdir(migrationsDirectory)).filter((name) => name.endsWith('.sql')).sort();

        for (const name of migrationNames) {
            const [migration] = await sql<{ name: string }[]>`
        SELECT name FROM schema_migrations WHERE name = ${name}
      `;
            if (migration) continue;

            const statement = await fs.readFile(path.join(migrationsDirectory, name), 'utf8');
            await sql.begin(async (transaction) => {
                await transaction.unsafe(statement);
                await transaction`INSERT INTO schema_migrations (name) VALUES (${name})`;
            });

            console.info(`Applied migration ${name}`);
        }
    } finally {
        await sql.end();
    }
}

migrate().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
});
