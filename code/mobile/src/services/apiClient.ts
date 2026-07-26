const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "");

const REQUEST_TIMEOUT_MS = 10_000;
let accessToken: string | null = null;

async function postJson(path: string, payload: unknown) {
  if (!API_BASE_URL) {
    throw new Error("Sync is not configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

async function getJson(path: string) {
  if (!API_BASE_URL) throw new Error("Sync is not configured.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  return response.json();
}

function withoutLocalFields(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  const { id: _id, vehicleId: _vehicleId, currentMileage: _currentMileage, ...syncPayload } = payload as Record<string, unknown>;
  return syncPayload;
}

function isGuestSessionResponse(value: unknown): value is { accessToken: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "accessToken" in value &&
      typeof (value as { accessToken?: unknown }).accessToken === "string",
  );
}

export const apiClient = {
  isConfigured: Boolean(API_BASE_URL),
  hasSession: () => Boolean(accessToken),
  setAccessToken: (token: string | null) => {
    accessToken = token;
  },
  createGuestSession: async () => {
    const response = await postJson("/auth/guest", {});

    if (!isGuestSessionResponse(response)) {
      throw new Error("The backend returned an invalid guest session.");
    }

    return response;
  },
  syncVehicle: (payload: unknown) => postJson("/vehicles", withoutLocalFields(payload)),
  syncFuelEntry: (payload: unknown) =>
    postJson("/fuel-entries", withoutLocalFields(payload)),
  syncMaintenanceEntry: (payload: unknown) =>
    postJson("/maintenance-entries", withoutLocalFields(payload)),
  pullChanges: (after: number) => getJson(`/sync?after=${after}`),
};
