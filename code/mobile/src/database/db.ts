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
      odometer INTEGER
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
      amount REAL,
      date TEXT
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
    addColumnIfMissing('maintenance_entries', 'clientId', 'TEXT');
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
    db.execSync(`UPDATE maintenance_entries SET clientId = 'legacy-maintenance-' || id WHERE clientId IS NULL;`);
    db.execSync(`UPDATE charging_entries SET clientId = 'legacy-charging-' || id WHERE clientId IS NULL;`);
    db.execSync(`UPDATE ownership_expenses SET clientId = 'legacy-expense-' || id WHERE clientId IS NULL;`);

    db.execSync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_client_id ON vehicles(clientId);`);
    db.execSync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_fuel_entries_client_id ON fuel_entries(clientId);`);
    db.execSync(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_maintenance_entries_client_id ON maintenance_entries(clientId);`,
    );
    db.execSync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_charging_entries_client_id ON charging_entries(clientId);`);
    db.execSync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ownership_expenses_client_id ON ownership_expenses(clientId);`);
    db.execSync(`CREATE INDEX IF NOT EXISTS idx_fuel_entries_vehicle_date ON fuel_entries(vehicleId, date DESC);`);
    db.execSync(
        `CREATE INDEX IF NOT EXISTS idx_maintenance_entries_vehicle_date ON maintenance_entries(vehicleId, date DESC);`,
    );
    db.execSync(`CREATE INDEX IF NOT EXISTS idx_charging_entries_vehicle_date ON charging_entries(vehicleId, date DESC);`);
    db.execSync(`CREATE INDEX IF NOT EXISTS idx_ownership_expenses_vehicle_date ON ownership_expenses(vehicleId, date DESC);`);
    db.execSync(`CREATE INDEX IF NOT EXISTS idx_sync_queue_due ON sync_queue(nextAttemptAt, createdAt, id);`);
};

function addColumnIfMissing(tableName: string, columnName: string, definition: string) {
    const columns = db.getAllSync<{ name: string }>(`PRAGMA table_info(${tableName})`);

    if (!columns.some((column) => column.name === columnName)) {
        db.execSync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
    }
}
