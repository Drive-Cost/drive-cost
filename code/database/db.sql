CREATE TABLE vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand TEXT,
  model TEXT,
  year INTEGER,
  currentMileage INTEGER
);

CREATE TABLE fuel_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicleId INTEGER,
  date TEXT,
  liters REAL,
  price REAL,
  odometer INTEGER
);

CREATE TABLE maintenance_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicleId INTEGER,
  type TEXT,
  description TEXT,
  cost REAL,
  date TEXT,
  odometer INTEGER
);