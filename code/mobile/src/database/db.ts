import * as SQLite from "expo-sqlite";

export const db = SQLite.openDatabaseSync("drivecost.db");

export const initDatabase = () => {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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

  const vehicleColumns = db.getAllSync<{ name: string }>(
    `PRAGMA table_info(vehicles)`,
  );
  const columnNames = new Set(vehicleColumns.map((column) => column.name));

  if (!columnNames.has("ownershipStartMileage")) {
    db.execSync(`ALTER TABLE vehicles ADD COLUMN ownershipStartMileage INTEGER;`);
  }

  if (!columnNames.has("label")) {
    db.execSync(`ALTER TABLE vehicles ADD COLUMN label TEXT;`);
  }

  if (!columnNames.has("fuelType")) {
    db.execSync(`ALTER TABLE vehicles ADD COLUMN fuelType TEXT;`);
  }

  if (!columnNames.has("engine")) {
    db.execSync(`ALTER TABLE vehicles ADD COLUMN engine TEXT;`);
  }

  if (!columnNames.has("powerHp")) {
    db.execSync(`ALTER TABLE vehicles ADD COLUMN powerHp INTEGER;`);
  }

  if (!columnNames.has("transmission")) {
    db.execSync(`ALTER TABLE vehicles ADD COLUMN transmission TEXT;`);
  }

  if (!columnNames.has("trackingStartMileage")) {
    db.execSync(`ALTER TABLE vehicles ADD COLUMN trackingStartMileage INTEGER;`);
  }

  if (!columnNames.has("currentOdometer")) {
    db.execSync(`ALTER TABLE vehicles ADD COLUMN currentOdometer INTEGER;`);
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
      vehicleId INTEGER,
      type TEXT,
      description TEXT,
      cost REAL,
      date TEXT,
      odometer INTEGER
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entityType TEXT,
      operation TEXT,
      payload TEXT,
      createdAt TEXT,
      lastError TEXT
    );
  `);
};
