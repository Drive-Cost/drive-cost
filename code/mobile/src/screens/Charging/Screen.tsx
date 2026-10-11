import { useVehicleData } from '../../hooks/useVehicleData';
import type { VehicleDataSource } from '../../hooks/useVehicleData';
import { VehicleDataNotice } from '../../components/VehicleDataNotice';
import { useEffect, useReducer } from 'react';
import { reduce, initialState } from './reducer';
import type { Input } from './reducer';
import { useSubmissionGuard } from '../../hooks/useSubmissionGuard';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DeleteEntryButton } from '../../components/entry/DeleteEntryButton';
import { todayCalendarDate } from '../../domain/entryDate';
import { validateEnergyEntryForm, validateNewEntryOdometer } from '../../domain/formValidation';
import { useChargingStore } from '../../store/chargingStore';
import { useVehicleStore } from '../../store/vehicleStore';
import { isElectricVehicle } from '../../services/vehicle/vehicleProfile';
import { energyTransactionCostLabel } from '../../services/vehicle/vehicleCopy';
import { QuickAddField } from '../../components/entry/QuickAddField';
import { QuickAddVehicleContext } from '../../components/entry/QuickAddVehicleContext';
import { RootStackParamList } from '../../navigation/types';
import { completeQuickAdd } from '../../navigation/completeQuickAdd';

const dataSources: readonly VehicleDataSource[] = ['charging'];

const emptyInput = (): Input => ({ date: todayCalendarDate(), kWh: '', price: '', odometer: '' });

type ChargingScreenProps = NativeStackScreenProps<RootStackParamList, 'ChargingEntry'>;

export default function ChargingScreen({ navigation }: ChargingScreenProps) {
  const { vehicles, activeVehicleId } = useVehicleStore();
  const { chargingEntries, createChargingEntry, deleteChargingEntry } = useChargingStore();
  const [state, dispatch] = useReducer(reduce, undefined, () => initialState(emptyInput()));
  const { form } = state;
  const error = state.tag === 'editing' ? state.error : null;
  const setError = (message: string | null) => dispatch({ type: 'error', message });
  const submitOnce = useSubmissionGuard();
  const isSaving = state.tag !== 'editing';
  const vehicle = vehicles.find(item => item.id === activeVehicleId);
  const activeChargingEntries = chargingEntries.filter(entry => entry.vehicleId === activeVehicleId);

  const data = useVehicleData(activeVehicleId, dataSources);

  useEffect(() => {
    if (vehicle && !form.odometer)
      dispatch({ type: 'change', field: 'odometer', value: String(vehicle.currentOdometer) });
  }, [form.odometer, vehicle]);

  const save = async () => {
    if (!activeVehicleId || state.tag !== 'editing') return;
    const result = validateEnergyEntryForm({
      quantity: form.kWh,
      price: form.price,
      odometer: form.odometer,
      date: form.date,
    });
    if (!result.ok) return setError(result.error);
    if (vehicle) {
      const odometer = validateNewEntryOdometer(result.value.odometer, vehicle.currentOdometer);
      if (!odometer.ok) return setError(odometer.error);
    }
    await submitOnce(async () => {
      dispatch({ type: 'save' });
      try {
        await createChargingEntry({
          vehicleId: activeVehicleId,
          date: result.value.date,
          kWh: result.value.quantity,
          price: result.value.price,
          odometer: result.value.odometer,
        });

        dispatch({ type: 'saved' });
        completeQuickAdd(navigation);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to save this charging session.');
      }
    });
  };

  if (!vehicle || !isElectricVehicle(vehicle)) {
    return (
      <View style={styles.empty}>
        <Text style={styles.title}>Charging</Text>
        <Text style={styles.copy}>Select an electric vehicle in Garage to record charging sessions.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Add charge</Text>
      <Text style={styles.copy}>Record a charging session for your active vehicle.</Text>
      <QuickAddVehicleContext vehicle={vehicle} />
      <VehicleDataNotice status={data.status} onRetry={data.retry} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <QuickAddField
        editable={!isSaving}
        label="Energy added (kWh)"
        value={form.kWh}
        keyboardType="decimal-pad"
        onChangeText={value => dispatch({ type: 'change', field: 'kWh', value })}
      />
      <QuickAddField
        editable={!isSaving}
        label={energyTransactionCostLabel}
        value={form.price}
        keyboardType="decimal-pad"
        onChangeText={value => dispatch({ type: 'change', field: 'price', value })}
      />
      <QuickAddField
        editable={!isSaving}
        label="Odometer"
        value={form.odometer}
        keyboardType="number-pad"
        onChangeText={value => dispatch({ type: 'change', field: 'odometer', value })}
      />
      <QuickAddField
        editable={!isSaving}
        label="Date"
        placeholder="YYYY-MM-DD"
        value={form.date}
        onChangeText={value => dispatch({ type: 'change', field: 'date', value })}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save charge"
        disabled={isSaving}
        style={styles.button}
        onPress={() => {
          void save();
        }}
      >
        <Text style={styles.buttonText}>Save charge</Text>
      </Pressable>
      <Text style={styles.historyTitle}>Charging history</Text>
      {activeChargingEntries.map(entry => (
        <View key={entry.id} style={styles.row}>
          <View>
            <Text>
              {entry.kWh.toFixed(1)} kWh · EUR {entry.price.toFixed(2)}
            </Text>
            <Text>{entry.odometer.toLocaleString()} km</Text>
          </View>
          <DeleteEntryButton
            disabled={isSaving}
            entryId={entry.id}
            vehicleId={activeVehicleId}
            onDelete={deleteChargingEntry}
            onError={setError}
          />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20 },
  empty: { flex: 1, justifyContent: 'center', padding: 20 },
  title: { fontSize: 28, fontWeight: '700' },
  copy: { marginTop: 8, color: '#475569' },
  error: { color: '#b91c1c', marginTop: 12 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbe4ee',
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
  },
  button: { marginTop: 12, padding: 15, backgroundColor: '#0f172a', borderRadius: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  historyTitle: { marginTop: 24, fontSize: 18, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
});
