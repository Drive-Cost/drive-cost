import * as SQLite from 'expo-sqlite';
import { SyncOperation } from '../domain/sync';

export const db = SQLite.openDatabaseSync('drivecost.db');

export const initDatabase = () => {
    db.execSync(`PRAGMA foreign_keys = ON;`);

    db.execSync(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clientId TEXT,
      brand TEXT,
      model TEXT,
      year INTEGER,
      label TEXT,
      fuelType TEXT,
      engine TEXT,
      powerHp INTEGER,
      transmission TEXT,
      currentMileage INTEGER,
      ownershipStartMileage INTEGER,
      trackingStartMileage INTEGER,
      trackingStartDate TEXT,
      currentOdometer INTEGER
    );
  `);

    const vehicleColumns = db.getAllSync<{ name: string }>(`PRAGMA table_info(vehicles)`);
    const columnNames = new Set(vehicleColumns.map((column) => column.name));

    if (!columnNames.has('ownershipStartMileage')) {
        db.execSync(`ALTER TABLE vehicles ADD COLUMN ownershipStartMileage INTEGER;`);
    }

    if (!columnNames.has('label')) {
        db.execSync(`ALTER TABLE vehicles ADD COLUMN label TEXT;`);
    }

    if (!columnNames.has('fuelType')) {
        db.execSync(`ALTER TABLE vehicles ADD COLUMN fuelType TEXT;`);
    }

    if (!columnNames.has('engine')) {
        db.execSync(`ALTER TABLE vehicles ADD COLUMN engine TEXT;`);
    }

    if (!columnNames.has('powerHp')) {
        db.execSync(`ALTER TABLE vehicles ADD COLUMN powerHp INTEGER;`);
    }

    if (!columnNames.has('transmission')) {
        db.execSync(`ALTER TABLE vehicles ADD COLUMN transmission TEXT;`);
    }

    if (!columnNames.has('trackingStartMileage')) {
        db.execSync(`ALTER TABLE vehicles ADD COLUMN trackingStartMileage INTEGER;`);
    }

    if (!columnNames.has('currentOdometer')) {
        db.execSync(`ALTER TABLE vehicles ADD COLUMN currentOdometer INTEGER;`);
    }

    if (!columnNames.has('trackingStartDate')) {
        db.execSync(`ALTER TABLE vehicles ADD COLUMN trackingStartDate TEXT;`);
    }

    if (!columnNames.has('clientId')) {
        db.execSync(`ALTER TABLE vehicles ADD COLUMN clientId TEXT;`);
    }

    db.execSync(`
    UPDATE vehicles
    SET ownershipStartMileage = COALESCE(ownershipStartMileage, currentMileage, currentOdometer, 0),
        trackingStartMileage = COALESCE(trackingStartMileage, currentMileage, currentOdometer, 0),
        currentOdometer = COALESCE(currentOdometer, currentMileage, trackingStartMileage, ownershipStartMileage, 0)
    WHERE ownershipStartMileage IS NULL
       OR trackingStartMileage IS NULL
       OR currentOdometer IS NULL;
  `);

    db.execSync(`
    CREATE TABLE IF NOT EXISTS fuel_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clientId TEXT,
      vehicleId INTEGER,
      date TEXT,
      liters REAL,
      price REAL,
      odometer INTEGER,
      fillStatus TEXT NOT NULL DEFAULT 'unknown'
    );
  `);

    db.execSync(`
    CREATE TABLE IF NOT EXISTS maintenance_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clientId TEXT,
      vehicleId INTEGER,
      type TEXT,
      description TEXT,
      cost REAL,
      date TEXT,
      odometer INTEGER
    );
  `);

    db.execSync(`
    CREATE TABLE IF NOT EXISTS charging_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clientId TEXT,
      vehicleId INTEGER,
      date TEXT,
      kWh REAL,
      price REAL,
      odometer INTEGER
    );
  `);

    db.execSync(`
    CREATE TABLE IF NOT EXISTS ownership_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clientId TEXT,
      vehicleId INTEGER,
      category TEXT,
      description TEXT,
      totalPaid REAL,
      date TEXT,
      odometer INTEGER
    );
  `);

    db.execSync(`
    CREATE TABLE IF NOT EXISTS recurring_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clientId TEXT,
      vehicleId INTEGER,
      category TEXT,
      amount REAL,
      periodMonths INTEGER,
      startDate TEXT,
      nextDueDate TEXT,
      description TEXT,
      active INTEGER NOT NULL DEFAULT 1
    );
  `);

    db.execSync(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entityType TEXT,
      operation TEXT,
      payload TEXT,
      createdAt TEXT,
      lastError TEXT,
      retryCount INTEGER NOT NULL DEFAULT 0,
      nextAttemptAt TEXT
    );
  `);

    db.execSync(`
    CREATE TABLE IF NOT EXISTS sync_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

    addColumnIfMissing('fuel_entries', 'clientId', 'TEXT');
    addColumnIfMissing('fuel_entries', 'fillStatus', "TEXT NOT NULL DEFAULT 'unknown'");
    addColumnIfMissing('maintenance_entries', 'clientId', 'TEXT');
    addColumnIfMissing('ownership_expenses', 'clientId', 'TEXT');
    addColumnIfMissing('ownership_expenses', 'totalPaid', 'REAL');
    addColumnIfMissing('ownership_expenses', 'odometer', 'INTEGER');
    addColumnIfMissing('recurring_expenses', 'clientId', 'TEXT');
    addColumnIfMissing('recurring_expenses', 'nextDueDate', 'TEXT');
    addColumnIfMissing('recurring_expenses', 'description', 'TEXT');
    addColumnIfMissing('recurring_expenses', 'active', 'INTEGER NOT NULL DEFAULT 1');
    addColumnIfMissing('sync_queue', 'retryCount', 'INTEGER NOT NULL DEFAULT 0');
    addColumnIfMissing('sync_queue', 'nextAttemptAt', 'TEXT');

    db.execSync(
        `UPDATE sync_queue
         SET operation = '${SyncOperation.Upsert}'
         WHERE operation IS NULL
            OR operation NOT IN ('${SyncOperation.Upsert}', '${SyncOperation.Delete}');`,
    );

    // Existing local data predates sync. Assign stable identifiers once so that
    // future retries and edits target the same remote record.
    db.execSync(`UPDATE vehicles SET clientId = 'legacy-vehicle-' || id WHERE clientId IS NULL;`);
    db.execSync(`UPDATE fuel_entries SET clientId = 'legacy-fuel-' || id WHERE clientId IS NULL;`);
    db.execSync(`
      UPDATE fuel_entries
      SET fillStatus = 'unknown'
      WHERE fillStatus IS NULL OR fillStatus NOT IN ('full', 'partial', 'unknown');
    `);
    db.execSync(`UPDATE maintenance_entries SET clientId = 'legacy-maintenance-' || id WHERE clientId IS NULL;`);
    db.execSync(`UPDATE charging_entries SET clientId = 'legacy-charging-' || id WHERE clientId IS NULL;`);
    db.execSync(`UPDATE ownership_expenses SET clientId = 'legacy-expense-' || id WHERE clientId IS NULL;`);
    db.execSync(`UPDATE recurring_expenses SET clientId = 'legacy-recurring-expense-' || id WHERE clientId IS NULL;`);
    db.execSync(`UPDATE recurring_expenses SET active = 1 WHERE active IS NULL;`);
    // The pre-DC-102 table had an unused amount column. Keep every row and
    // carry that value forward rather than dropping or rewriting the table.
    const expenseColumns = db.getAllSync<{ name: string }>(`PRAGMA table_info(ownership_expenses)`);
    if (expenseColumns.some((column) => column.name === 'amount')) {
        db.execSync(`UPDATE ownership_expenses SET totalPaid = COALESCE(totalPaid, amount) WHERE totalPaid IS NULL;`);
    }
    db.execSync(`UPDATE ownership_expenses SET category = 'other' WHERE category IS NULL OR category NOT IN ('insurance', 'tax', 'inspection', 'tolls', 'parking', 'carWash', 'financingInterest', 'accessories', 'other');`);

    migrateVehicleOwnedTablesToCascade();
    db.execSync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_client_id ON vehicles(clientId);`);
    db.execSync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_fuel_entries_client_id ON fuel_entries(clientId);`);
    db.execSync(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_maintenance_entries_client_id ON maintenance_entries(clientId);`,
    );
    db.execSync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_charging_entries_client_id ON charging_entries(clientId);`);
    db.execSync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ownership_expenses_client_id ON ownership_expenses(clientId);`);
    db.execSync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_recurring_expenses_client_id ON recurring_expenses(clientId);`);
    db.execSync(`CREATE INDEX IF NOT EXISTS idx_fuel_entries_vehicle_date ON fuel_entries(vehicleId, date DESC);`);
    db.execSync(
        `CREATE INDEX IF NOT EXISTS idx_maintenance_entries_vehicle_date ON maintenance_entries(vehicleId, date DESC);`,
    );
    db.execSync(`CREATE INDEX IF NOT EXISTS idx_charging_entries_vehicle_date ON charging_entries(vehicleId, date DESC);`);
    db.execSync(`CREATE INDEX IF NOT EXISTS idx_ownership_expenses_vehicle_date ON ownership_expenses(vehicleId, date DESC);`);
    db.execSync(`CREATE INDEX IF NOT EXISTS idx_recurring_expenses_vehicle_active ON recurring_expenses(vehicleId, active, startDate DESC);`);
    db.execSync(`CREATE INDEX IF NOT EXISTS idx_sync_queue_due ON sync_queue(nextAttemptAt, createdAt, id);`);
};

function addColumnIfMissing(tableName: string, columnName: string, definition: string) {
    const columns = db.getAllSync<{ name: string }>(`PRAGMA table_info(${tableName})`);

    if (!columns.some((column) => column.name === columnName)) {
        db.execSync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
    }
}

/**
 * The original local schema did not declare the ownership relationship. SQLite
 * cannot add a foreign key with ALTER TABLE, so upgrade each child table once
 * by rebuilding it with the same columns and an ON DELETE CASCADE constraint.
 */
function migrateVehicleOwnedTablesToCascade() {
    const tables = [
        ['fuel_entries', 'id, clientId, vehicleId, date, liters, price, odometer, fillStatus'],
        ['maintenance_entries', 'id, clientId, vehicleId, type, description, cost, date, odometer'],
        ['charging_entries', 'id, clientId, vehicleId, date, kWh, price, odometer'],
        ['ownership_expenses', 'id, clientId, vehicleId, category, description, totalPaid, date, odometer'],
        ['recurring_expenses', 'id, clientId, vehicleId, category, amount, periodMonths, startDate, nextDueDate, description, active'],
    ] as const;

    if (tables.every(([table]) => hasVehicleCascade(table))) return;

    db.execSync('PRAGMA foreign_keys = OFF;');
    db.execSync('BEGIN;');
    try {
        for (const [table, columns] of tables) {
            const replacement = `${table}_with_vehicle_fk`;
            db.execSync(`ALTER TABLE ${table} RENAME TO ${replacement};`);
            db.execSync(createVehicleOwnedTableSql(table));
            // The join preserves every valid owned record and removes only
            // pre-existing orphans, which cannot safely participate in costs.
            db.execSync(`INSERT INTO ${table} (${columns}) SELECT ${columns} FROM ${replacement} WHERE vehicleId IN (SELECT id FROM vehicles);`);
            db.execSync(`DROP TABLE ${replacement};`);
        }
        db.execSync('COMMIT;');
    } catch (error) {
        db.execSync('ROLLBACK;');
        throw error;
    } finally {
        db.execSync('PRAGMA foreign_keys = ON;');
    }
}

function hasVehicleCascade(table: string): boolean {
    return db.getAllSync<{ table: string; on_delete: string }>(`PRAGMA foreign_key_list(${table})`)
        .some((foreignKey) => foreignKey.table === 'vehicles' && foreignKey.on_delete.toUpperCase() === 'CASCADE');
}

function createVehicleOwnedTableSql(table: string): string {
    const definitions: Record<string, string> = {
        fuel_entries: 'id INTEGER PRIMARY KEY AUTOINCREMENT, clientId TEXT, vehicleId INTEGER NOT NULL, date TEXT, liters REAL, price REAL, odometer INTEGER, fillStatus TEXT NOT NULL DEFAULT \'unknown\'',
        maintenance_entries: 'id INTEGER PRIMARY KEY AUTOINCREMENT, clientId TEXT, vehicleId INTEGER NOT NULL, type TEXT, description TEXT, cost REAL, date TEXT, odometer INTEGER',
        charging_entries: 'id INTEGER PRIMARY KEY AUTOINCREMENT, clientId TEXT, vehicleId INTEGER NOT NULL, date TEXT, kWh REAL, price REAL, odometer INTEGER',
        ownership_expenses: 'id INTEGER PRIMARY KEY AUTOINCREMENT, clientId TEXT, vehicleId INTEGER NOT NULL, category TEXT, description TEXT, totalPaid REAL, date TEXT, odometer INTEGER',
        recurring_expenses: 'id INTEGER PRIMARY KEY AUTOINCREMENT, clientId TEXT, vehicleId INTEGER NOT NULL, category TEXT, amount REAL, periodMonths INTEGER, startDate TEXT, nextDueDate TEXT, description TEXT, active INTEGER NOT NULL DEFAULT 1',
    };
    return `CREATE TABLE ${table} (${definitions[table]}, FOREIGN KEY (vehicleId) REFERENCES vehicles(id) ON DELETE CASCADE);`;
}
