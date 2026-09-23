import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { VehicleForm } from '../components/vehicle/VehicleForm';
import { useVehicleStore } from '../store/vehicleStore';
import { GarageStackParamList } from '../navigation/types';
import { editVehicleIntroCopy } from '../services/vehicle/vehicleCopy';

type EditVehicleScreenProps = NativeStackScreenProps<GarageStackParamList, 'EditVehicle'>;

export default function EditVehicleScreen({ navigation, route }: EditVehicleScreenProps) {
    const { vehicles, saveVehicle, deleteVehicle } = useVehicleStore();
    const { vehicleId } = route.params;
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
        <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
            <Text style={styles.title}>Edit vehicle</Text>
            <Text style={styles.subtitle}>{editVehicleIntroCopy}</Text>
            <VehicleForm
                initialVehicle={vehicle}
                submitLabel="Save changes"
                onSubmit={async (changes) => {
                    await saveVehicle({ id: vehicle.id, clientId: vehicle.clientId, ...changes });
                    navigation.goBack();
                }}
            />
            <View style={styles.dangerZone}>
                <Text style={styles.dangerTitle}>Danger zone</Text>
                <Text style={styles.dangerCopy}>Deleting this vehicle also removes its recorded DriveCost history.</Text>
                <Pressable
                    style={styles.deleteButton}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${vehicle.label || `${vehicle.brand} ${vehicle.model}`}`}
                    onPress={() => {
                        const vehicleName = vehicle.label || `${vehicle.brand} ${vehicle.model}`;
                        Alert.alert(
                            `Delete ${vehicleName}?`,
                            'Its recorded DriveCost history will also be removed.',
                            [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                    text: 'Delete vehicle',
                                    style: 'destructive',
                                    onPress: () => {
                                        void deleteVehicle(vehicle.id!).then(
                                            () => navigation.popToTop(),
                                            () => Alert.alert('Could not delete vehicle', 'Please try again. Your vehicle and history are still available.'),
                                        );
                                    },
                                },
                            ],
                        );
                    }}
                >
                    <Text style={styles.deleteButtonText}>Delete vehicle</Text>
                </Pressable>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#f8fafc' },
    content: { padding: 20, paddingBottom: 28 },
    title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
    subtitle: { marginTop: 8, marginBottom: 20, color: '#475569', lineHeight: 22 },
    dangerZone: { marginTop: 36, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#fecaca' },
    dangerTitle: { color: '#991b1b', fontSize: 18, fontWeight: '700' },
    dangerCopy: { marginTop: 6, color: '#7f1d1d', lineHeight: 20 },
    deleteButton: { marginTop: 16, alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, backgroundColor: '#b91c1c' },
    deleteButtonText: { color: '#fff', fontWeight: '700' },
});
