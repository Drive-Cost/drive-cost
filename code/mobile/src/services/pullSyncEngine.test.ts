import { describe, expect, it } from "vitest";
import { RemoteChange } from "../domain/sync";
import { PullSyncDependencies, reconcilePulledChanges } from "./pullSyncEngine";

interface MemoryTransaction {
  readonly marker: "transaction";
}

interface MemoryReplica {
  cursor: number;
  readonly vehicles: Map<string, { localId: number; odometer: number }>;
  readonly fuelEntries: Map<string, { vehicleId: number; liters: number }>;
  readonly maintenanceEntries: Map<string, { vehicleId: number; cost: number }>;
  readonly pendingOutbox: Array<{ clientId: string }>;
}

describe("reconcilePulledChanges", () => {
  it("replays client IDs safely, resolves entry parents locally, and leaves the outbox untouched", async () => {
    const changes: RemoteChange[] = [
      vehicleChange(1, "vehicle-a", 12_000),
      fuelChange(2, "fuel-a", "vehicle-a", 42),
      maintenanceChange(3, "maintenance-a", "vehicle-a", 90),
      vehicleChange(4, "vehicle-a", 12_500),
    ];
    const replica = createReplica();

    await reconcilePulledChanges(createDependencies(replica, changes));
    replica.cursor = 0;
    await reconcilePulledChanges(createDependencies(replica, changes));

    expect(replica.vehicles).toEqual(
      new Map([["vehicle-a", { localId: 41, odometer: 12_500 }]]),
    );
    expect(replica.fuelEntries).toEqual(
      new Map([["fuel-a", { vehicleId: 41, liters: 42 }]]),
    );
    expect(replica.maintenanceEntries).toEqual(
      new Map([["maintenance-a", { vehicleId: 41, cost: 90 }]]),
    );
    expect(replica.pendingOutbox).toEqual([{ clientId: "local-pending" }]);
    expect(replica.cursor).toBe(4);
  });

  it("advances the cursor only after each complete committed batch", async () => {
    const changes: RemoteChange[] = [
      vehicleChange(1, "vehicle-a", 10_000),
      vehicleChange(2, "vehicle-b", 20_000),
      fuelChange(3, "fuel-a", "vehicle-a", 31),
    ];
    const replica = createReplica();
    const committedCursors: number[] = [];

    await reconcilePulledChanges(
      createDependencies(replica, changes, (cursor) => committedCursors.push(cursor)),
    );

    expect(committedCursors).toEqual([2, 3]);
    expect(replica.cursor).toBe(3);
  });

  it("rolls back entity writes and cursor advancement when a batch cannot be applied", async () => {
    const replica = createReplica();
    const changes: RemoteChange[] = [
      vehicleChange(1, "vehicle-a", 10_000),
      fuelChange(2, "fuel-a", "missing-vehicle", 31),
    ];

    await expect(reconcilePulledChanges(createDependencies(replica, changes))).rejects.toThrow(
      "vehicle is synced",
    );

    expect(replica.vehicles).toEqual(new Map());
    expect(replica.fuelEntries).toEqual(new Map());
    expect(replica.cursor).toBe(0);
    expect(replica.pendingOutbox).toEqual([{ clientId: "local-pending" }]);
  });
});

function createReplica(): MemoryReplica {
  return {
    cursor: 0,
    vehicles: new Map(),
    fuelEntries: new Map(),
    maintenanceEntries: new Map(),
    pendingOutbox: [{ clientId: "local-pending" }],
  };
}

function createDependencies(
  replica: MemoryReplica,
  changes: RemoteChange[],
  onCursorCommitted?: (cursor: number) => void,
): PullSyncDependencies<MemoryTransaction> {
  return {
    getCursor: async () => replica.cursor,
    pullChanges: async (after) => {
      const data = changes.filter((change) => change.sequence > after).slice(0, 2);
      return {
        data,
        nextCursor: data.at(-1)?.sequence ?? after,
      };
    },
    withTransaction: async (operation) => {
      const vehicleSnapshot = new Map(replica.vehicles);
      const fuelSnapshot = new Map(replica.fuelEntries);
      const maintenanceSnapshot = new Map(replica.maintenanceEntries);
      const cursorSnapshot = replica.cursor;

      try {
        await operation({ marker: "transaction" });
      } catch (error) {
        replaceMap(replica.vehicles, vehicleSnapshot);
        replaceMap(replica.fuelEntries, fuelSnapshot);
        replaceMap(replica.maintenanceEntries, maintenanceSnapshot);
        replica.cursor = cursorSnapshot;
        throw error;
      }
    },
    applyChange: async (change) => {
      if (change.entityType === "vehicle") {
        const existing = replica.vehicles.get(change.payload.clientId);
        replica.vehicles.set(change.payload.clientId, {
          localId: existing?.localId ?? 41 + replica.vehicles.size,
          odometer: change.payload.currentOdometer,
        });
        return;
      }

      if (change.entityType === "fuel_entry") {
        const vehicle = replica.vehicles.get(change.payload.vehicleClientId);
        if (!vehicle) throw new Error("Cannot apply a fuel entry before its vehicle is synced.");
        replica.fuelEntries.set(change.payload.clientId, {
          vehicleId: vehicle.localId,
          liters: change.payload.liters,
        });
        return;
      }

      const vehicle = replica.vehicles.get(change.payload.vehicleClientId);
      if (!vehicle) throw new Error("Cannot apply maintenance before its vehicle is synced.");
      replica.maintenanceEntries.set(change.payload.clientId, {
        vehicleId: vehicle.localId,
        cost: change.payload.cost,
      });
    },
    setCursor: async (cursor) => {
      replica.cursor = cursor;
      onCursorCommitted?.(cursor);
    },
  };
}

function replaceMap<Key, Value>(target: Map<Key, Value>, source: Map<Key, Value>) {
  target.clear();
  for (const [key, value] of source) target.set(key, value);
}

function vehicleChange(
  sequence: number,
  clientId: string,
  currentOdometer: number,
): RemoteChange {
  return {
    sequence,
    entityType: "vehicle",
    payload: {
      clientId,
      brand: "Toyota",
      model: "Corolla",
      year: 2022,
      ownershipStartMileage: 8_000,
      trackingStartMileage: 9_000,
      currentOdometer,
    },
  };
}

function fuelChange(
  sequence: number,
  clientId: string,
  vehicleClientId: string,
  liters: number,
): RemoteChange {
  return {
    sequence,
    entityType: "fuel_entry",
    payload: {
      clientId,
      vehicleClientId,
      date: "2026-07-26T12:00:00.000Z",
      odometer: 10_000,
      liters,
      price: 72.5,
    },
  };
}

function maintenanceChange(
  sequence: number,
  clientId: string,
  vehicleClientId: string,
  cost: number,
): RemoteChange {
  return {
    sequence,
    entityType: "maintenance_entry",
    payload: {
      clientId,
      vehicleClientId,
      date: "2026-07-26T13:00:00.000Z",
      odometer: 10_100,
      type: "Oil service",
      description: "Oil and filter replacement",
      cost,
    },
  };
}
