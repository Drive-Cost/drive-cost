# DriveCost — Mobile App Architecture

## Overview

DriveCost is a React Native mobile application built with Expo and TypeScript.

The architecture prioritizes:

- simplicity
- fast development
- maintainability
- offline-first design

The app stores data locally using SQLite and synchronizes to cloud services in future versions.

The repository may also include a backend module under `code/backend/` once
sync, accounts, subscriptions, and curated domain data become active work.

---

# Technology Stack

Frontend

- React Native
- Expo
- TypeScript

State Management

- Zustand

Database

- SQLite (local-first)

Navigation

- React Navigation

Charts (future)

- react-native-svg
- victory-native

---

# Folder Structure

mobile/

backend/

src/

components/  
Reusable UI components

screens/  
Application screens

database/  
SQLite initialization and queries

models/  
TypeScript models

services/  
Business logic

store/  
Global state management

navigation/  
Navigation configuration

backend/src/  
Future backend modules and APIs

---

# Layer Responsibilities

## Screens

Responsible for UI and user interaction.

Examples:

- GarageScreen
- DashboardScreen
- FuelScreen
- MaintenanceScreen

---

## Components

Reusable UI pieces.

Examples:

- VehicleCard
- CostSummary
- AddButton

---

## Database

Responsible for all SQLite queries.

Example files:

- db.ts
- vehicleRepository.ts
- fuelRepository.ts
- maintenanceRepository.ts

---

## Services

Contains business logic and calculations.

Examples:

- cost calculations
- analytics
- projections

---

## Store

Global state management using Zustand.

Responsible for:

- current vehicle
- cached data
- UI state

---

# Data Flow

User Action

↓

Screen

↓

Store

↓

Database

↓

UI update

Future synchronized flow:

User Action

↓

Screen

↓

Store

↓

Local Database

↓

Sync Layer

↓

Backend API
