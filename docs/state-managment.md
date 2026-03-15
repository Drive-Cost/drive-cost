# DriveCost — State Management

## Overview

DriveCost uses Zustand for global state management.

Reasons for choosing Zustand:

- minimal boilerplate
- simple API
- works well with React Native
- easier than Redux for small apps

---

# Global State

Global state stores:

- vehicles
- selected vehicle
- fuel entries
- maintenance entries

---

# Store Structure

store/

vehicleStore.ts  
fuelStore.ts  
maintenanceStore.ts

---

# Vehicle Store Example

Responsibilities:

- load vehicles
- add vehicle
- delete vehicle
- select current vehicle

---

# Example Store Shape

vehicles: Vehicle[]

selectedVehicleId: number | null

actions:

loadVehicles()  
addVehicle()  
removeVehicle()  
selectVehicle()

---

# State Flow

Screen calls store action

↓

Store updates SQLite

↓

Store updates local state

↓

React rerenders UI
