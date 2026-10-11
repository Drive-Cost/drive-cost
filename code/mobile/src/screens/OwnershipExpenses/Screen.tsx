import { useVehicleData } from '../../hooks/useVehicleData';
import type { VehicleDataSource } from '../../hooks/useVehicleData';
import { VehicleDataNotice } from '../../components/VehicleDataNotice';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DeleteEntryButton } from '../../components/entry/DeleteEntryButton';
import { EditEntryButton } from '../../components/entry/EditEntryButton';
import { reduce } from './reducer';
import type { Input } from './reducer';
import { useEntryEditor } from '../../hooks/useEntryEditor/useEntryEditor';
import { validateExpenseEntryForm } from '../../domain/formValidation';
import { ENTRY_DATE_PLACEHOLDER, toCalendarDate, todayCalendarDate } from '../../domain/entryDate';
import { ExpenseCategory, ExpenseEntry } from '../../models/ExpenseEntry';
import { formatCurrency } from '../../services/vehicle/costCalculator';
import { expenseCategoryLabels, getExpenseCategoryLabel } from '../../services/vehicle/expenseCopy';
import { useExpenseStore } from '../../store/expenseStore';
import { useVehicleStore } from '../../store/vehicleStore';
import { RecurringCostsSection } from './components/RecurringCosts/Section';
import { QuickAddField } from '../../components/entry/QuickAddField';

const dataSources: readonly VehicleDataSource[] = ['expenses'];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function OwnershipExpensesScreen() {
  const { vehicles, activeVehicleId } = useVehicleStore();
  const { expenseEntries, createExpenseEntry, updateExpenseEntry, deleteExpenseEntry } = useExpenseStore();
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
  } = useEntryEditor(createEmptyExpenseForm, toInput, reduce);

  const vehicle = vehicles.find(item => item.id === activeVehicleId);

  const data = useVehicleData(activeVehicleId, dataSources);

  useEffect(() => {
    cancelIfVehicleChanged(activeVehicleId);
  }, [activeVehicleId, cancelIfVehicleChanged]);

  const handleSave = async () => {
    if (!activeVehicleId) return;
    const result = validateExpenseEntryForm({
      category: formInput.category,
      totalPaid: formInput.totalPaid,
      date: formInput.date,
      odometer: formInput.odometer,
      description: formInput.description,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }

    await submit(async () => {
      const entry = { ...result.value, vehicleId: activeVehicleId };
      if (editingEntry) {
        await updateExpenseEntry({ ...editingEntry, ...entry });
      } else {
        await createExpenseEntry(entry);
      }
    });
  };

  const handleDelete = async (entryId: number, vehicleId: number) => {
    await deleteExpenseEntry(entryId, vehicleId);
    clearIfEditing(entryId);
  };

  const recentExpenses = [...expenseEntries.filter(entry => entry.vehicleId === activeVehicleId)].sort((left, right) =>
    right.date.localeCompare(left.date)
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Ownership expenses</Text>
      <Text style={styles.subtitle}>
        Record costs like insurance, tax, tolls, parking, and accessories. Service and repair work belongs in
        Maintenance.
      </Text>

      {vehicle ? <Text style={styles.vehicleName}>{vehicle.label || `${vehicle.brand} ${vehicle.model}`}</Text> : null}
      <VehicleDataNotice status={data.status} onRetry={data.retry} />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.paymentTitle}>Payments / expenses</Text>
      <Text style={styles.fieldLabel}>Category</Text>
      <View style={styles.categoryGrid}>
        {Object.values(ExpenseCategory).map(category => (
          <Pressable
            key={category}
            accessibilityRole="button"
            accessibilityLabel={expenseCategoryLabels[category]}
            accessibilityState={{ selected: formInput.category === category }}
            style={[styles.categoryButton, formInput.category === category && styles.categoryButtonSelected]}
            onPress={() => updateFormInput('category', category)}
          >
            <Text style={[styles.categoryText, formInput.category === category && styles.categoryTextSelected]}>
              {expenseCategoryLabels[category]}
            </Text>
          </Pressable>
        ))}
      </View>

      <QuickAddField
        editable={!isSaving}
        label="Date"
        placeholder={ENTRY_DATE_PLACEHOLDER}
        placeholderTextColor="#94a3b8"
        value={formInput.date}
        onChangeText={value => updateFormInput('date', value)}
      />
      <QuickAddField
        editable={!isSaving}
        label="Total paid"
        placeholderTextColor="#94a3b8"
        value={formInput.totalPaid}
        keyboardType="decimal-pad"
        onChangeText={value => updateFormInput('totalPaid', value)}
      />
      <QuickAddField
        editable={!isSaving}
        label="Odometer"
        optional
        placeholderTextColor="#94a3b8"
        value={formInput.odometer}
        keyboardType="number-pad"
        onChangeText={value => updateFormInput('odometer', value)}
      />
      <QuickAddField
        editable={!isSaving}
        label="Description"
        optional
        placeholderTextColor="#94a3b8"
        value={formInput.description}
        onChangeText={value => updateFormInput('description', value)}
      />

      <Pressable
        accessibilityState={{ disabled: isSaving || activeVehicleId === null, busy: isSaving }}
        style={[styles.button, !activeVehicleId && styles.buttonDisabled]}
        disabled={isSaving || activeVehicleId === null}
        onPress={handleSave}
      >
        <Text style={styles.buttonText}>
          {isSaving ? 'Saving…' : editingEntry ? 'Update ownership expense' : 'Save ownership expense'}
        </Text>
      </Pressable>
      {editingEntry ? (
        <Pressable style={styles.secondaryButton} disabled={isSaving} onPress={clearEditor}>
          <Text style={styles.secondaryButtonText}>Cancel edit</Text>
        </Pressable>
      ) : null}
      {!activeVehicleId ? (
        <Text style={styles.helperText}>Select a vehicle in Garage before recording an ownership expense.</Text>
      ) : null}

      <View style={styles.historyCard}>
        <Text style={styles.historyTitle}>Payment history</Text>
        {data.status !== 'ready' ? null : recentExpenses.length === 0 ? (
          <Text style={styles.emptyHistory}>No ownership expenses yet.</Text>
        ) : (
          recentExpenses.map(entry => (
            <View key={entry.id} style={styles.historyItem}>
              <View style={styles.historyCopy}>
                <Text style={styles.historyPrimary}>{getExpenseCategoryLabel(entry.category)}</Text>
                <Text style={styles.historyMeta}>{entry.description || 'Ownership expense'}</Text>
                <Text style={styles.historyMeta}>
                  {entry.odometer === undefined
                    ? formatDate(entry.date)
                    : `${entry.odometer.toLocaleString()} km • ${formatDate(entry.date)}`}
                </Text>
              </View>
              <View style={styles.historyActions}>
                <Text style={styles.historyAmount}>{formatCurrency(entry.totalPaid)}</Text>
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
          ))
        )}
      </View>
      {vehicle ? <RecurringCostsSection vehicle={vehicle} /> : null}
    </ScrollView>
  );
}

function toInput(entry: ExpenseEntry): Input {
  return {
    category: entry.category,
    date: toCalendarDate(entry.date),
    totalPaid: String(entry.totalPaid),
    odometer: entry.odometer === undefined ? '' : String(entry.odometer),
    description: entry.description ?? '',
  };
}

function createEmptyExpenseForm(): Input {
  return { category: '', date: todayCalendarDate(), totalPaid: '', odometer: '', description: '' };
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20, paddingBottom: 28 },
  title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
  subtitle: { marginTop: 8, marginBottom: 12, color: '#475569', lineHeight: 22 },
  vehicleName: { marginBottom: 16, color: '#0369a1', fontWeight: '600' },
  paymentTitle: { marginBottom: 12, color: '#0f172a', fontSize: 18, fontWeight: '600' },
  fieldLabel: { marginBottom: 8, color: '#334155', fontWeight: '600' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  categoryButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4ee',
  },
  categoryButtonSelected: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  categoryText: { color: '#334155', fontSize: 14 },
  categoryTextSelected: { color: '#ffffff' },
  error: { marginBottom: 12, color: '#b91c1c', lineHeight: 20 },
  button: { marginTop: 8, backgroundColor: '#0f172a', borderRadius: 16, alignItems: 'center', paddingVertical: 15 },
  buttonDisabled: { backgroundColor: '#94a3b8' },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  secondaryButton: { marginTop: 10, alignItems: 'center', paddingVertical: 12 },
  secondaryButtonText: { color: '#2563eb', fontWeight: '600' },
  helperText: { marginTop: 12, color: '#475569' },
  historyCard: {
    marginTop: 20,
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  historyTitle: { fontSize: 18, fontWeight: '600', color: '#0f172a', marginBottom: 8 },
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
  historyActions: { alignItems: 'flex-end', gap: 8 },
  historyAmount: { color: '#0f172a', fontWeight: '600' },
});
