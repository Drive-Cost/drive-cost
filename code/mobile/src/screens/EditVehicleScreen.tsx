import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { VehicleForm, VehicleFormMode } from '../components/vehicle/VehicleForm';
import { useVehicleStore } from '../store/vehicleStore';

export default function EditVehicleScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const { vehicles, saveVehicle } = useVehicleStore();
    const vehicleId = readVehicleId(route.params);
    const vehicle = useMemo(() => vehicles.find((item) => item.id === vehicleId), [vehicleId, vehicles]);

    if (!vehicle) {
        return (
            <View style={styles.screen}>
                <Text style={styles.title}>Vehicle not found</Text>
                <Text style={styles.subtitle}>Go back to Garage and choose a car to edit.</Text>
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            <Text style={styles.title}>Edit vehicle</Text>
            <Text style={styles.subtitle}>
                Adjust ownership start, tracking baseline, and current odometer separately. This is also where the first
                layer of domain details lives.
            </Text>
            <VehicleForm
                mode={VehicleFormMode.Edit}
                initialVehicle={vehicle}
                submitLabel="Save changes"
                onSubmit={async (changes) => {
                    await saveVehicle({ id: vehicle.id, clientId: vehicle.clientId, ...changes });
                    navigation.goBack();
                }}
            />
        </View>
    );
}

function readVehicleId(params: unknown): number | null {
    if (!params || typeof params !== 'object' || !('vehicleId' in params)) return null;
    const vehicleId = (params as { vehicleId?: unknown }).vehicleId;
    return typeof vehicleId === 'number' ? vehicleId : null;
}

const styles = StyleSheet.create({
    screen: { flex: 1, padding: 20, backgroundColor: '#f8fafc' },
    title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
    subtitle: { marginTop: 8, marginBottom: 20, color: '#475569', lineHeight: 22 },
});
