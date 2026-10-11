import { useVehicleData } from '../../hooks/useVehicleData';
import type { VehicleDataSource } from '../../hooks/useVehicleData';
import { VehicleDataNotice } from '../../components/VehicleDataNotice';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMaintenanceStore } from '../../store/maintenanceStore';
import { useVehicleStore } from '../../store/vehicleStore';
import { formatCurrency } from '../../services/vehicle/costCalculator';
import { validateMaintenanceEntryForm, validateNewEntryOdometer } from '../../domain/formValidation';
import { DeleteEntryButton } from '../../components/entry/DeleteEntryButton';
import { EditEntryButton } from '../../components/entry/EditEntryButton';
import { MaintenanceEntry } from '../../models/MaintenanceEntry';
import { useEntryEditor } from '../../hooks/useEntryEditor/useEntryEditor';
import { reduce } from './reducer';
import type { Input } from './reducer';
import { toCalendarDate, todayCalendarDate } from '../../domain/entryDate';
import { maintenanceIntroCopy } from '../../services/vehicle/vehicleCopy';
import { QuickAddField } from '../../components/entry/QuickAddField';
import { QuickAddVehicleContext } from '../../components/entry/QuickAddVehicleContext';
import { RootStackParamList } from '../../navigation/types';
import { completeQuickAdd } from '../../navigation/completeQuickAdd';

const dataSources: readonly VehicleDataSource[] = ['maintenance'];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

type MaintenanceScreenProps = NativeStackScreenProps<RootStackParamList, 'MaintenanceEntry'>;

export default function MaintenanceScreen({ navigation }: MaintenanceScreenProps) {
  const { maintenanceEntries, createMaintenanceEntry, updateMaintenanceEntry, deleteMaintenanceEntry } =
    useMaintenanceStore();
  const { vehicles, activeVehicleId } = useVehicleStore();

  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  const {
    isSaving,
    submit,
    formInput,
    error,
    setError,
    editingEntry,
    updateFormInput,
    clearEditor,
    startEditing,
    cancelIfVehicleChanged,
    clearIfEditing,
  } = useEntryEditor(createEmptyMaintenanceForm, toInput, reduce);

  const vehicle = vehicles.find(item => item.id === activeVehicleId);
  const data = useVehicleData(activeVehicleId, dataSources);

  useEffect(() => {
    cancelIfVehicleChanged(activeVehicleId);
  }, [activeVehicleId, cancelIfVehicleChanged]);

  useEffect(() => {
    if (vehicle && !editingEntry && !formInput.odometer) {
      updateFormInput('odometer', String(vehicle.currentOdometer));
    }
  }, [editingEntry, formInput.odometer, updateFormInput, vehicle]);

  const handleDelete = async (entryId: number, vehicleId: number) => {
    await deleteMaintenanceEntry(entryId, vehicleId);
    clearIfEditing(entryId);
  };

  const handleSave = async () => {
    if (!activeVehicleId) return;
    const result = validateMaintenanceEntryForm({
      type: formInput.type,
      cost: formInput.cost,
      odometer: formInput.odometer,
      date: formInput.date,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (!editingEntry && vehicle) {
      const odometer = validateNewEntryOdometer(result.value.odometer, vehicle.currentOdometer);
      if (!odometer.ok) {
        setError(odometer.error);
        return;
      }
    }

    const saved = await submit(async () => {
      if (editingEntry) {
        await updateMaintenanceEntry({
          ...editingEntry,
          date: result.value.date,
          type: result.value.type,
          description: formInput.description,
          cost: result.value.cost,
          odometer: result.value.odometer,
        });
      } else {
        await createMaintenanceEntry({
          vehicleId: activeVehicleId,
          type: result.value.type,
          description: formInput.description,
          cost: result.value.cost,
          date: result.value.date,
          odometer: result.value.odometer,
        });
      }
    });
    if (saved && !editingEntry) completeQuickAdd(navigation);
  };

  const recentMaintenanceEntries = [...maintenanceEntries.filter(entry => entry.vehicleId === activeVehicleId)]
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 6);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>{editingEntry ? 'Edit maintenance' : 'Add maintenance'}</Text>
      <Text style={styles.subtitle}>{maintenanceIntroCopy}</Text>

      <VehicleDataNotice status={data.status} onRetry={data.retry} />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {vehicle ? <QuickAddVehicleContext vehicle={vehicle} /> : null}

      <QuickAddField
        editable={!isSaving}
        label="What was done"
        value={formInput.type}
        onChangeText={value => updateFormInput('type', value)}
      />

      <QuickAddField
        editable={!isSaving}
        label="Total paid"
        value={formInput.cost}
        keyboardType="decimal-pad"
        onChangeText={value => updateFormInput('cost', value)}
      />

      <QuickAddField
        editable={!isSaving}
        label="Odometer"
        value={formInput.odometer}
        keyboardType="number-pad"
        onChangeText={value => updateFormInput('odometer', value)}
      />

      <QuickAddField
        editable={!isSaving}
        label="Date"
        placeholder="YYYY-MM-DD"
        value={formInput.date}
        onChangeText={value => updateFormInput('date', value)}
      />

      {editingEntry || showOptionalDetails ? (
        <QuickAddField
          editable={!isSaving}
          label="Description"
          optional
          value={formInput.description}
          onChangeText={value => updateFormInput('description', value)}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add optional maintenance details"
          style={styles.optionalButton}
          onPress={() => setShowOptionalDetails(true)}
        >
          <Text style={styles.optionalButtonText}>Add optional details</Text>
        </Pressable>
      )}

      <Pressable
        accessibilityState={{ disabled: isSaving || activeVehicleId === null, busy: isSaving }}
        style={[styles.button, !activeVehicleId && styles.buttonDisabled]}
        accessibilityRole="button"
        accessibilityLabel={editingEntry ? 'Save maintenance changes' : 'Save maintenance'}
        disabled={isSaving || activeVehicleId === null}
        onPress={handleSave}
      >
        <Text style={styles.buttonText}>
          {isSaving ? 'Saving…' : editingEntry ? 'Update maintenance entry' : 'Save maintenance entry'}
        </Text>
      </Pressable>

      {editingEntry ? (
        <Pressable style={styles.secondaryButton} disabled={isSaving} onPress={clearEditor}>
          <Text style={styles.secondaryButtonText}>Cancel edit</Text>
        </Pressable>
      ) : null}

      {!activeVehicleId ? (
        <Text style={styles.helperText}>Select a vehicle in Garage before logging maintenance.</Text>
      ) : null}

      <View style={styles.historyCard}>
        <Text style={styles.historyTitle}>Recent maintenance</Text>
        <Text style={styles.historySubtitle}>Repairs and regular service stay visible in one local timeline.</Text>

        {data.status !== 'ready' ? null : recentMaintenanceEntries.length === 0 ? (
          <Text style={styles.emptyHistory}>No maintenance entries yet. Your saved services will show up here.</Text>
        ) : (
          recentMaintenanceEntries.map(entry => {
            return (
              <View key={entry.id} style={styles.historyItem}>
                <View style={styles.historyCopy}>
                  <Text style={styles.historyPrimary}>{entry.type || 'Maintenance'}</Text>
                  <Text style={styles.historyMeta}>{entry.description || 'Service entry'}</Text>
                  <Text style={styles.historyMeta}>
                    {entry.odometer.toLocaleString()} km • {formatDate(entry.date)}
                  </Text>
                </View>
                <View style={styles.historyActions}>
                  <Text style={styles.historyAmount}>{formatCurrency(entry.cost)}</Text>
                  <EditEntryButton
                    disabled={isSaving}
                    onPress={() => {
                      startEditing(entry);
                    }}
                  />
                  <DeleteEntryButton
                    disabled={isSaving}
                    entryId={entry.id}
                    vehicleId={activeVehicleId}
                    onDelete={handleDelete}
                    onError={setError}
                  />
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

function toInput(entry: MaintenanceEntry): Input {
  return {
    date: toCalendarDate(entry.date),
    type: entry.type,
    description: entry.description,
    cost: String(entry.cost),
    odometer: String(entry.odometer),
  };
}

function createEmptyMaintenanceForm(): Input {
  return { date: todayCalendarDate(), type: '', description: '', cost: '', odometer: '' };
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20, paddingBottom: 28 },
  title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
  subtitle: { marginTop: 8, marginBottom: 20, color: '#475569', lineHeight: 22 },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#dbe4ee',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 12,
    color: '#0f172a',
  },
  error: { marginBottom: 12, color: '#b91c1c', lineHeight: 20 },
  button: { marginTop: 8, backgroundColor: '#0f172a', borderRadius: 16, alignItems: 'center', paddingVertical: 15 },
  buttonDisabled: { backgroundColor: '#94a3b8' },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  secondaryButton: { marginTop: 10, alignItems: 'center', paddingVertical: 12 },
  secondaryButtonText: { color: '#2563eb', fontWeight: '600' },
  optionalButton: { alignSelf: 'flex-start', marginBottom: 12, paddingVertical: 8 },
  optionalButtonText: { color: '#2563eb', fontWeight: '600' },
  helperText: { marginTop: 12, color: '#475569' },
  historyCard: {
    marginTop: 20,
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  historyTitle: { fontSize: 18, fontWeight: '600', color: '#0f172a' },
  historySubtitle: { marginTop: 4, marginBottom: 12, color: '#64748b', lineHeight: 20 },
  emptyHistory: { color: '#64748b', lineHeight: 22 },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  historyCopy: { flex: 1, paddingRight: 16 },
  historyPrimary: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  historyMeta: { marginTop: 4, color: '#475569', lineHeight: 20 },
  historyAmount: { color: '#0f172a', fontWeight: '600' },
  historyActions: { alignItems: 'flex-end', gap: 8 },
});
