import { useEffect, useReducer, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { DeleteEntryButton } from '../components/entry/DeleteEntryButton';
import { ENTRY_DATE_PLACEHOLDER, todayCalendarDate } from '../domain/entryDate';
import { validateEnergyEntryForm } from '../domain/formValidation';
import { useChargingStore } from '../store/chargingStore';
import { useVehicleStore } from '../store/vehicleStore';
import { isElectricVehicle } from '../services/vehicle/vehicleProfile';

type ChargingForm = { date: string; kWh: string; price: string; odometer: string };
type ChargingFormAction = { field: keyof ChargingForm; value: string } | { reset: true };

const EMPTY_FORM = (): ChargingForm => ({ date: todayCalendarDate(), kWh: '', price: '', odometer: '' });

function chargingFormReducer(state: ChargingForm, action: ChargingFormAction): ChargingForm {
    return 'reset' in action ? EMPTY_FORM() : { ...state, [action.field]: action.value };
}

export default function ChargingScreen() {
    const { vehicles, activeVehicleId, syncVehicleOdometer } = useVehicleStore();
    const { chargingEntries, loadChargingEntries, createChargingEntry, deleteChargingEntry } = useChargingStore();
    const [form, dispatch] = useReducer(chargingFormReducer, undefined, EMPTY_FORM);
    const [error, setError] = useState<string | null>(null);
    const vehicle = vehicles.find((item) => item.id === activeVehicleId);

    useEffect(() => {
        if (activeVehicleId) void loadChargingEntries(activeVehicleId);
    }, [activeVehicleId, loadChargingEntries]);

    const save = async () => {
        if (!activeVehicleId) return;
        const result = validateEnergyEntryForm({ quantity: form.kWh, price: form.price, odometer: form.odometer, date: form.date });
        if (!result.ok) return setError(result.error);
        try {
            await createChargingEntry({
                vehicleId: activeVehicleId,
                date: result.value.date,
                kWh: result.value.quantity,
                price: result.value.price,
                odometer: result.value.odometer,
            });
            await syncVehicleOdometer(activeVehicleId, result.value.odometer);
            dispatch({ reset: true });
            setError(null);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Unable to save this charging session.');
        }
    };

    if (!vehicle || !isElectricVehicle(vehicle)) {
        return <View style={styles.empty}><Text style={styles.title}>Charging</Text><Text style={styles.copy}>Select an electric vehicle in Garage to record charging sessions.</Text></View>;
    }

    return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Charging</Text><Text style={styles.copy}>Record charging separately from fuel.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {(['date', 'kWh', 'price', 'odometer'] as const).map((field) => <TextInput key={field} style={styles.input} value={form[field]}
            placeholder={field === 'date' ? ENTRY_DATE_PLACEHOLDER : field === 'kWh' ? 'kWh' : field === 'price' ? 'Price' : 'Odometer'}
            keyboardType={field === 'date' ? 'default' : field === 'odometer' ? 'number-pad' : 'decimal-pad'}
            onChangeText={(value) => dispatch({ field, value })} />)}
        <Pressable style={styles.button} onPress={save}><Text style={styles.buttonText}>Save charging session</Text></Pressable>
        <Text style={styles.historyTitle}>Charging history</Text>
        {chargingEntries.map((entry) => <View key={entry.id} style={styles.row}><View><Text>{entry.kWh.toFixed(1)} kWh · EUR {entry.price.toFixed(2)}</Text><Text>{entry.odometer.toLocaleString()} km</Text></View><DeleteEntryButton entryId={entry.id} vehicleId={activeVehicleId} onDelete={deleteChargingEntry} onError={setError} /></View>)}
    </ScrollView>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: '#f8fafc' }, content: { padding: 20 }, empty: { flex: 1, justifyContent: 'center', padding: 20 }, title: { fontSize: 28, fontWeight: '700' }, copy: { marginTop: 8, color: '#475569' }, error: { color: '#b91c1c', marginTop: 12 }, input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe4ee', borderRadius: 16, padding: 14, marginTop: 12 }, button: { marginTop: 12, padding: 15, backgroundColor: '#0f172a', borderRadius: 16, alignItems: 'center' }, buttonText: { color: '#fff', fontWeight: '600' }, historyTitle: { marginTop: 24, fontSize: 18, fontWeight: '600' }, row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#e2e8f0' } });
