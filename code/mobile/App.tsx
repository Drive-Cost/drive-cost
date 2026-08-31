import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { initDatabase } from './src/database/db';
import { useEffect } from 'react';
import { useVehicleStore } from './src/store/vehicleStore';
import { useFuelStore } from './src/store/fuelStore';
import { useMaintenanceStore } from './src/store/maintenanceStore';
import { subscribeToRemoteChanges, syncDevice } from './src/services/sync/syncService';

export default function App() {
    const { loadVehicles } = useVehicleStore();

    useEffect(() => {
        const unsubscribe = subscribeToRemoteChanges(async () => {
            await loadVehicles();
            const activeVehicleId = useVehicleStore.getState().activeVehicleId;

            if (activeVehicleId) {
                await Promise.all([
                    useFuelStore.getState().loadFuelEntries(activeVehicleId),
                    useMaintenanceStore.getState().loadMaintenanceEntries(activeVehicleId),
                ]);
            }
        });

        async function bootstrap() {
            initDatabase();
            await loadVehicles();

            try {
                await syncDevice();
            } catch {
                // Offline boot is expected; queued changes remain local.
            }
        }

        void bootstrap();
        return unsubscribe;
    }, []);

    return (
        <NavigationContainer>
            <AppNavigator />
        </NavigationContainer>
    );
}
