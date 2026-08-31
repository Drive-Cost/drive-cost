import { describe, expect, it } from "vitest";
import {
  validateEnergyEntryForm,
  validateMaintenanceEntryForm,
  validateVehicleForm,
} from "../../src/domain/formValidation";

const validVehicle = {
  brand: "Toyota",
  model: "Corolla",
  year: "2022",
  label: "Daily driver",
  fuelType: "Petrol",
  engine: "1.8 Hybrid",
  powerHp: "122",
  transmission: "Automatic",
  ownershipStartMileage: "12000",
  trackingStartMileage: "15000",
  currentOdometer: "18000",
};

describe("vehicle form validation", () => {
  it("parses a valid ownership-distance model", () => {
    const result = validateVehicleForm(validVehicle);

    expect(result).toEqual({
      ok: true,
      value: {
        brand: "Toyota",
        model: "Corolla",
        year: 2022,
        label: "Daily driver",
        fuelType: "Petrol",
        engine: "1.8 Hybrid",
        powerHp: 122,
        transmission: "Automatic",
        ownershipStartMileage: 12000,
        trackingStartMileage: 15000,
        currentOdometer: 18000,
      },
    });
  });

  it("rejects an impossible tracking baseline", () => {
    const result = validateVehicleForm({
      ...validVehicle,
      trackingStartMileage: "11000",
    });

    expect(result).toEqual({
      ok: false,
      error: "Tracking start mileage cannot be before ownership start mileage.",
    });
  });

  it("rejects a current odometer before the tracking baseline", () => {
    const result = validateVehicleForm({
      ...validVehicle,
      currentOdometer: "14000",
    });

    expect(result).toEqual({
      ok: false,
      error: "Current odometer cannot be before tracking start mileage.",
    });
  });
});

describe("entry form validation", () => {
  it("allows a zero-cost charging entry", () => {
    expect(
      validateEnergyEntryForm({ quantity: "42.5", price: "0", odometer: "18010" }),
    ).toEqual({
      ok: true,
      value: { quantity: 42.5, price: 0, odometer: 18010 },
    });
  });

  it("rejects missing maintenance type and negative cost", () => {
    expect(
      validateMaintenanceEntryForm({ type: "", cost: "-25", odometer: "18010" }),
    ).toEqual({ ok: false, error: "Maintenance type is required." });
  });
});
