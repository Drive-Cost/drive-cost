import { Platform } from "react-native";

const API_BASE_URL =
  Platform.OS === "android" ? "http://10.0.2.2:8787" : "http://localhost:8787";

async function postJson(path: string, payload: unknown) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

export const apiClient = {
  createGuestSession: () => postJson("/auth/guest", {}),
  syncVehicle: (payload: unknown) => postJson("/vehicles", payload),
  syncFuelEntry: (payload: unknown) => postJson("/fuel-entries", payload),
  syncMaintenanceEntry: (payload: unknown) =>
    postJson("/maintenance-entries", payload),
};
