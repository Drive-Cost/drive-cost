import * as SecureStore from "expo-secure-store";
import { apiClient } from "./apiClient";

const ACCESS_TOKEN_KEY = "drivecost.access-token";

/**
 * Restores an existing device session or creates a guest account when online.
 * Local SQLite remains fully usable if this cannot reach the backend.
 */
export async function initializeAuthSession(): Promise<void> {
  if (!apiClient.isConfigured) {
    return;
  }

  const storedToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (storedToken) {
    apiClient.setAccessToken(storedToken);
    return;
  }

  const session = await apiClient.createGuestSession();
  apiClient.setAccessToken(session.accessToken);
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, session.accessToken);
}

export async function clearAuthSession(): Promise<void> {
  apiClient.setAccessToken(null);
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
}
