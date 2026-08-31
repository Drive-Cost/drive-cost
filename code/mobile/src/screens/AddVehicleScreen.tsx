import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { VehicleForm, VehicleFormMode } from '../components/vehicle/VehicleForm';
import { useVehicleStore } from '../store/vehicleStore';

export default function AddVehicleScreen() {
    const navigation = useNavigation();
    const { createVehicle } = useVehicleStore();

    return (
        <View style={styles.screen}>
            <Text style={styles.title}>Add vehicle</Text>
            <Text style={styles.subtitle}>
                Start with the essentials. We can layer in richer ownership data after the local MVP is stable.
            </Text>
            <VehicleForm
                mode={VehicleFormMode.Create}
                submitLabel="Save vehicle"
                onSubmit={async (vehicle) => {
                    await createVehicle(vehicle);
                    navigation.goBack();
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, padding: 20, backgroundColor: '#f8fafc' },
    title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
    subtitle: { marginTop: 8, marginBottom: 20, color: '#475569', lineHeight: 22 },
});
