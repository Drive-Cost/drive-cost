import { NavigationContainer } from "@react-navigation/native";
import AppNavigator from "./src/navigation/AppNavigator";
import { initDatabase } from "./src/database/db";
import { useEffect } from "react";
import { useVehicleStore } from "./src/store/vehicleStore";
import { processSyncQueue } from "./src/services/syncService";
import { initializeAuthSession } from "./src/services/authSession";

export default function App() {
  const { loadVehicles } = useVehicleStore();

  useEffect(() => {
    async function bootstrap() {
      initDatabase();
      await loadVehicles();

      try {
        await initializeAuthSession();
        await processSyncQueue();
      } catch {
        // Offline boot is expected; queued changes remain local.
      }
    }

    void bootstrap();
  }, []);

  return (
    <NavigationContainer>
      <AppNavigator />
    </NavigationContainer>
  );
}
