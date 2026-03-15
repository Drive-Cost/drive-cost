import { NavigationContainer } from "@react-navigation/native";
import AppNavigator from "./src/navigation/AppNavigator";
import { initDatabase } from "./src/database/db";
import { useEffect } from "react";
import { useVehicleStore } from "./src/store/vehicleStore";
import { processSyncQueue } from "./src/services/syncService";

export default function App() {
  const { loadVehicles } = useVehicleStore();

  useEffect(() => {
    initDatabase();
    loadVehicles();
    processSyncQueue().catch(() => {
      // Offline boot is expected; queued changes will sync later.
    });
  }, []);

  return (
    <NavigationContainer>
      <AppNavigator />
    </NavigationContainer>
  );
}
