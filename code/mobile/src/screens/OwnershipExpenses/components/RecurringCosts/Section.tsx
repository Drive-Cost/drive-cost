import { useVehicleData } from '../../../../hooks/useVehicleData';
import type { VehicleDataSource } from '../../../../hooks/useVehicleData';
import { VehicleDataNotice } from '../../../../components/VehicleDataNotice';
import { useEffect } from 'react';
import { useEntryEditor } from '../../../../hooks/useEntryEditor/useEntryEditor';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { validateRecurringExpenseForm } from '../../../../domain/formValidation';
import { toCalendarDate, todayCalendarDate } from '../../../../domain/entryDate';
import { ExpenseCategory } from '../../../../models/ExpenseEntry';
import { RecurringExpense, RecurringExpensePeriodMonths } from '../../../../models/RecurringExpense';
import { formatCurrency } from '../../../../services/vehicle/costCalculator';
import { expenseCategoryLabels, getExpenseCategoryLabel } from '../../../../services/vehicle/expenseCopy';
import { calculateNormalizedRecurringCost, monthlyEquivalent } from '../../../../services/vehicle/recurringCosts';
import { recurrenceAmountLabel, recurrenceLabels } from '../../../../services/vehicle/recurringExpenseCopy';
import { useRecurringExpenseStore } from '../../../../store/recurringExpenseStore';
import { Vehicle } from '../../../../models/Vehicle';
import { QuickAddField } from '../../../../components/entry/QuickAddField';

import { reduce } from './reducer';
import type { Input } from './reducer';

const dataSources: readonly VehicleDataSource[] = ['recurring'];
const periods = RecurringExpensePeriodMonths;

export function RecurringCostsSection({ vehicle }: { vehicle: Vehicle }) {
  const {
    recurringExpenses: allRecurringExpenses,
    createRecurringExpense,
    updateRecurringExpense,
    setRecurringExpenseActive,
    deleteRecurringExpense,
  } = useRecurringExpenseStore();
  const {
    isSaving,
    submit,
    formInput: form,
    editingEntry: editing,
    error,
    setError,
    updateFormInput: update,
    clearEditor,
    startEditing,
    cancelIfVehicleChanged,
    clearIfEditing,
  } = useEntryEditor(emptyForm, toInput, reduce);

  const data = useVehicleData(vehicle.id, dataSources);
  const recurringExpenses = allRecurringExpenses.filter(entry => entry.vehicleId === vehicle.id);
  const normalized = calculateNormalizedRecurringCost(vehicle, recurringExpenses, todayCalendarDate());
  useEffect(() => {
    cancelIfVehicleChanged(vehicle.id);
  }, [cancelIfVehicleChanged, vehicle.id]);

  const save = async () => {
    if (editing && editing.vehicleId !== vehicle.id) {
      clearEditor();
      return;
    }
    const result = validateRecurringExpenseForm(form);
    if (!result.ok) return setError(result.error);
    await submit(async () => {
      const schedule = { ...result.value, vehicleId: vehicle.id, active: editing?.active ?? true };
      if (editing) await updateRecurringExpense({ ...editing, ...schedule });
      else await createRecurringExpense(schedule);
    }, 'Unable to save this recurring cost. Please try again.');
  };

  const toggleActive = async (schedule: RecurringExpense) => {
    try {
      await setRecurringExpenseActive(schedule.id, vehicle.id, !schedule.active);
    } catch {
      setError('Unable to update this recurring cost. Please try again.');
    }
  };

  const removeSchedule = async (schedule: RecurringExpense) => {
    try {
      await deleteRecurringExpense(schedule.id, vehicle.id);
      clearIfEditing(schedule.id);
    } catch {
      setError('Unable to delete this recurring cost. Please try again.');
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Recurring costs</Text>
      <Text style={styles.subtitle}>
        Active commitments are normalized for planning. They are not payments or tracked transaction costs.
      </Text>
      <VehicleDataNotice status={data.status} onRetry={data.retry} />
      {data.status !== 'ready' ? null : normalized.monthlyEquivalent === null ? (
        <Text style={styles.limited}>
          Set “Started tracking on” in Edit vehicle to calculate a tracked monthly equivalent.
        </Text>
      ) : (
        <Text style={styles.monthly}>≈ {formatCurrency(normalized.monthlyEquivalent)}/month</Text>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.label}>Category</Text>
      <View style={styles.grid}>
        {Object.values(ExpenseCategory).map(category => (
          <Choice
            disabled={isSaving}
            key={category}
            selected={form.category === category}
            label={expenseCategoryLabels[category]}
            onPress={() => update('category', category)}
          />
        ))}
      </View>
      <QuickAddField
        editable={!isSaving}
        label="Amount per recurrence"
        placeholderTextColor="#94a3b8"
        value={form.amount}
        keyboardType="decimal-pad"
        onChangeText={value => update('amount', value)}
      />
      <Text style={styles.label}>Recurrence</Text>
      <View style={styles.grid}>
        {periods.map(period => (
          <Choice
            disabled={isSaving}
            key={period}
            selected={form.periodMonths === String(period)}
            label={recurrenceLabels[period]}
            onPress={() => update('periodMonths', String(period))}
          />
        ))}
      </View>
      <QuickAddField
        editable={!isSaving}
        label="Start date"
        placeholder="YYYY-MM-DD"
        placeholderTextColor="#94a3b8"
        value={form.startDate}
        onChangeText={value => update('startDate', value)}
      />
      <QuickAddField
        editable={!isSaving}
        label="Next due date"
        optional
        placeholder="YYYY-MM-DD"
        placeholderTextColor="#94a3b8"
        value={form.nextDueDate}
        onChangeText={value => update('nextDueDate', value)}
      />
      <QuickAddField
        editable={!isSaving}
        label="Description"
        optional
        placeholderTextColor="#94a3b8"
        value={form.description}
        onChangeText={value => update('description', value)}
      />
      <Pressable
        disabled={isSaving}
        accessibilityState={{ disabled: isSaving, busy: isSaving }}
        style={styles.button}
        onPress={() => {
          void save();
        }}
      >
        <Text style={styles.buttonText}>
          {isSaving ? 'Saving…' : editing ? 'Update recurring cost' : 'Save recurring cost'}
        </Text>
      </Pressable>
      {editing ? (
        <Pressable style={styles.cancel} disabled={isSaving} onPress={clearEditor}>
          <Text style={styles.cancelText}>Cancel edit</Text>
        </Pressable>
      ) : null}
      <View style={styles.list}>
        {data.status !== 'ready' ? null : recurringExpenses.length === 0 ? (
          <Text style={styles.empty}>No recurring costs yet.</Text>
        ) : (
          recurringExpenses.map(schedule => {
            const equivalent = monthlyEquivalent(schedule);
            return (
              <View key={schedule.id} style={styles.item}>
                <View style={styles.itemCopy}>
                  <Text style={styles.itemTitle}>
                    {getExpenseCategoryLabel(schedule.category)}
                    {schedule.active ? '' : ' · Inactive'}
                  </Text>
                  <Text style={styles.itemMeta}>
                    {formatCurrency(schedule.amount)} {recurrenceAmountLabel(schedule.periodMonths)}
                    {equivalent === null ? '' : ` • ≈ ${formatCurrency(equivalent)}/month`}
                  </Text>
                  <Text style={styles.itemMeta}>
                    Starts {toCalendarDate(schedule.startDate)}
                    {schedule.nextDueDate ? ` • Next due ${toCalendarDate(schedule.nextDueDate)}` : ''}
                  </Text>
                </View>
                <View style={styles.actions}>
                  <Pressable disabled={isSaving} onPress={() => startEditing(schedule)}>
                    <Text style={styles.edit}>Edit</Text>
                  </Pressable>
                  <Pressable
                    disabled={isSaving}
                    onPress={() => {
                      void toggleActive(schedule);
                    }}
                  >
                    <Text style={styles.toggle}>{schedule.active ? 'Deactivate' : 'Reactivate'}</Text>
                  </Pressable>
                  <Pressable
                    disabled={isSaving}
                    onPress={() => {
                      void removeSchedule(schedule);
                    }}
                  >
                    <Text style={styles.delete}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

function toInput(schedule: RecurringExpense): Input {
  return {
    category: schedule.category,
    amount: String(schedule.amount),
    periodMonths: String(schedule.periodMonths),
    startDate: toCalendarDate(schedule.startDate),
    nextDueDate: schedule.nextDueDate ? toCalendarDate(schedule.nextDueDate) : '',
    description: schedule.description ?? '',
  };
}

function Choice({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable disabled={disabled} style={[styles.choice, selected && styles.choiceSelected]} onPress={onPress}>
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function emptyForm(): Input {
  return {
    category: '',
    amount: '',
    periodMonths: '',
    startDate: todayCalendarDate(),
    nextDueDate: '',
    description: '',
  };
}

const styles = StyleSheet.create({
  section: {
    marginTop: 20,
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  title: { fontSize: 18, fontWeight: '600', color: '#0f172a' },
  subtitle: { marginTop: 4, color: '#64748b', lineHeight: 20 },
  monthly: { marginTop: 12, color: '#0369a1', fontSize: 20, fontWeight: '700' },
  limited: { marginTop: 12, color: '#b45309', lineHeight: 20 },
  label: { marginTop: 16, marginBottom: 8, color: '#334155', fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  choice: {
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4ee',
  },
  choiceSelected: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  choiceText: { color: '#334155', fontSize: 14 },
  choiceTextSelected: { color: '#ffffff' },
  error: { marginTop: 12, color: '#b91c1c' },
  button: { marginTop: 4, backgroundColor: '#0f172a', borderRadius: 16, alignItems: 'center', paddingVertical: 14 },
  buttonText: { color: '#ffffff', fontWeight: '600' },
  cancel: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { color: '#2563eb', fontWeight: '600' },
  list: { marginTop: 16 },
  empty: { color: '#64748b' },
  item: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingVertical: 12 },
  itemCopy: { flex: 1, paddingRight: 12 },
  itemTitle: { color: '#0f172a', fontWeight: '600' },
  itemMeta: { marginTop: 4, color: '#475569', lineHeight: 19 },
  actions: { alignItems: 'flex-end', gap: 8 },
  edit: { color: '#2563eb', fontWeight: '600' },
  toggle: { color: '#b45309', fontWeight: '600' },
  delete: { color: '#b91c1c', fontWeight: '600' },
});
