# DriveCost — Technical Specification

## Use Cases

### Add Vehicle

User adds a new car.

Input:

- brand
- model
- year
- ownership start mileage
- tracking start mileage
- current odometer
- optional fuel type, engine, power, transmission, and custom label

Result:

Vehicle appears in the garage.

---

### Record Fuel Fill-Up

User records a fuel event.

Input:

- date
- liters
- total price
- odometer

System calculates:

- fuel consumption
- cost per km

If the vehicle is electric, the same flow is used for charge sessions and
energy cost tracking.

---

### Record Maintenance

User records a maintenance event.

Input:

- type
- description
- cost
- date
- mileage

Example:

Oil change  
€80  
120,000 km

---

### View Dashboard

User opens the dashboard.

System displays:

- total car cost
- monthly spending
- fuel cost
- maintenance cost
- cost per km

---

### View Vehicle History

User can see a full timeline of vehicle events.

Example timeline:

2025 — turbo replacement (€900)  
2024 — oil change (€80)  
2024 — tires (€450)

---

### Manage Multiple Vehicles (Pro)

User can add multiple cars.

Each car has its own:

- fuel records
- maintenance history
- analytics

---

# Data Model

## Vehicle

Fields:

id  
brand  
model  
year  
label  
fuelType  
engine  
powerHp  
transmission  
ownershipStartMileage  
trackingStartMileage  
currentOdometer

---

## FuelEntry

Fields:

id  
vehicleId  
date  
liters  
price  
odometer

Derived values:

fuelConsumption  
costPerKm

---

## MaintenanceEntry

Fields:

id  
vehicleId  
type  
description  
cost  
date  
odometer

---

## User

Fields:

id  
email  
subscriptionPlan  
createdAt

---

# Relationships

User
└── Vehicles

Vehicle
├── FuelEntries
└── MaintenanceEntries

---

# Storage Strategy (MVP)

Local storage:

SQLite database.

Possible libraries:

- Expo SQLite
- Realm

---

# Future Backend

For sync and accounts:

Possible solutions:

- Supabase
- Firebase

---

# Derived Calculations

## Cost per Kilometer

TotalCost / TrackedDistance

---

## Total Cost

FuelCost + MaintenanceCost

---

## Monthly Cost

TotalCost / MonthsActive
