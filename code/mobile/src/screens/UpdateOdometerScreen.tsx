import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useVehicleStore } from '../store/vehicleStore';
import { getActiveVehicle } from '../services/vehicle/activeVehicle';
import { RootStackParamList } from '../navigation/types';
import { QuickAddField } from '../components/entry/QuickAddField';
import { completeQuickAdd } from '../navigation/completeQuickAdd';

type UpdateOdometerScreenProps = NativeStackScreenProps<RootStackParamList, 'UpdateOdometer'>;

export default function UpdateOdometerScreen({ navigation }: UpdateOdometerScreenProps) {
    const { vehicles, activeVehicleId, syncVehicleOdometer } = useVehicleStore();
    const vehicle = getActiveVehicle(vehicles, activeVehicleId);
    const [odometer, setOdometer] = useState(vehicle ? String(vehicle.currentOdometer) : '');
    const [error, setError] = useState<string | null>(null);

    if (!vehicle || activeVehicleId === null) {
        return <View style={styles.empty}><Text style={styles.title}>No active vehicle yet</Text><Text style={styles.copy}>Choose a vehicle in Garage before updating its odometer.</Text></View>;
    }

    const save = async () => {
        const value = Number(odometer);
        if (!odometer.trim() || !Number.isInteger(value) || value < vehicle.currentOdometer) {
            setError('Enter a whole-number odometer at or above the current odometer.');
            return;
        }
        try {
            await syncVehicleOdometer(activeVehicleId, value);
            setError(null);
            completeQuickAdd(navigation);
        } catch {
            setError('Unable to update the odometer. Please try again.');
        }
    };

    return (
        <View style={styles.screen}>
            <Text style={styles.title}>Update odometer</Text>
            <Text style={styles.copy}>Keep {vehicle.label || `${vehicle.brand} ${vehicle.model}`} current between recorded events. Current: {vehicle.currentOdometer.toLocaleString()} km.</Text>
            <QuickAddField label="Current odometer" value={odometer} keyboardType="number-pad" onChangeText={setOdometer} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Save odometer" style={styles.button} onPress={() => { void save(); }}><Text style={styles.buttonText}>Save odometer</Text></Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, padding: 20, backgroundColor: '#f8fafc' },
    empty: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f8fafc' },
    title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
    copy: { marginTop: 8, color: '#475569', lineHeight: 22 },
    error: { marginTop: 12, color: '#b91c1c' },
    button: { marginTop: 16, paddingVertical: 15, borderRadius: 16, alignItems: 'center', backgroundColor: '#0f172a' },
    buttonText: { color: '#ffffff', fontWeight: '600', fontSize: 16 },
});
