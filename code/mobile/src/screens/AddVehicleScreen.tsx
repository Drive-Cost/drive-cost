import { ScrollView, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CreateVehicleForm } from '../components/vehicle/CreateVehicleForm';
import { useVehicleStore } from '../store/vehicleStore';
import { GarageStackParamList } from '../navigation/types';
import { completeVehicleOnboarding } from '../navigation/completeVehicleOnboarding';

type AddVehicleScreenProps = NativeStackScreenProps<GarageStackParamList, 'AddVehicle'>;

export default function AddVehicleScreen({ navigation }: AddVehicleScreenProps) {
    const { createVehicle } = useVehicleStore();

    return (
        <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
            <Text style={styles.title}>Add your vehicle</Text>
            <Text style={styles.subtitle}>
                Start with the essentials. You can complete your vehicle profile later.
            </Text>
            <CreateVehicleForm
                onSubmit={async (vehicle) => {
                    await createVehicle(vehicle);
                    completeVehicleOnboarding(navigation);
                }}
            />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#f8fafc' },
    content: { padding: 20, paddingBottom: 28 },
    title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
    subtitle: { marginTop: 8, marginBottom: 20, color: '#475569', lineHeight: 22 },
});
