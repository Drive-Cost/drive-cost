import {
    ChargingEntrySyncPayload,
    FuelEntrySyncPayload,
    MaintenanceEntrySyncPayload,
    SyncEntity,
    VehicleSyncPayload,
} from '../../domain/sync';
import { ChargingEntry } from '../../models/ChargingEntry';
import { FuelEntry } from '../../models/FuelEntry';
import { MaintenanceEntry } from '../../models/MaintenanceEntry';
import { Vehicle } from '../../models/Vehicle';

export function toVehicleSyncPayload(vehicle: Vehicle): VehicleSyncPayload {
    return {
        clientId: requiredClientId(vehicle.clientId, SyncEntity.Vehicle),
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        label: vehicle.label,
        fuelType: vehicle.fuelType,
        engine: vehicle.engine,
        powerHp: vehicle.powerHp,
        transmission: vehicle.transmission,
        ownershipStartMileage: vehicle.ownershipStartMileage,
        trackingStartMileage: vehicle.trackingStartMileage,
        currentOdometer: vehicle.currentOdometer,
    };
}

export function toFuelEntrySyncPayload(entry: FuelEntry, vehicleClientId: string): FuelEntrySyncPayload {
    return {
        clientId: requiredClientId(entry.clientId, SyncEntity.FuelEntry),
        vehicleClientId,
        date: entry.date,
        liters: entry.liters,
        price: entry.price,
        odometer: entry.odometer,
    };
}

export function toChargingEntrySyncPayload(entry: ChargingEntry, vehicleClientId: string): ChargingEntrySyncPayload {
    return {
        clientId: requiredClientId(entry.clientId, SyncEntity.ChargingEntry),
        vehicleClientId,
        date: entry.date,
        kWh: entry.kWh,
        price: entry.price,
        odometer: entry.odometer,
    };
}

export function toMaintenanceEntrySyncPayload(
    entry: MaintenanceEntry,
    vehicleClientId: string,
): MaintenanceEntrySyncPayload {
    return {
        clientId: requiredClientId(entry.clientId, SyncEntity.MaintenanceEntry),
        vehicleClientId,
        type: entry.type,
        description: entry.description,
        cost: entry.cost,
        date: entry.date,
        odometer: entry.odometer,
    };
}


const ENTITY_DISPLAY_NAME: Record<(typeof SyncEntity)[keyof typeof SyncEntity], string> = {
    [SyncEntity.Vehicle]: 'vehicle',
    [SyncEntity.FuelEntry]: 'fuel entry',
    [SyncEntity.ChargingEntry]: 'charging entry',
    [SyncEntity.MaintenanceEntry]: 'maintenance entry',
};

function requiredClientId(
    clientId: string | undefined,
    entityType: (typeof SyncEntity)[keyof typeof SyncEntity],
): string {
    if (!clientId) throw new Error(`Cannot sync a ${ENTITY_DISPLAY_NAME[entityType]} without a client ID.`);
    return clientId;
}
