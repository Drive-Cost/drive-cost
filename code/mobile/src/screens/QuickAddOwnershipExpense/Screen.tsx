import { useReducer, useRef } from 'react';
import { initialState, reduce } from './reducer';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { QuickAddField } from '../../components/entry/QuickAddField';
import { QuickAddVehicleContext } from '../../components/entry/QuickAddVehicleContext';
import { todayCalendarDate } from '../../domain/entryDate';
import { validateExpenseEntryForm } from '../../domain/formValidation';
import { ExpenseCategory } from '../../models/ExpenseEntry';
import { RootStackParamList } from '../../navigation/types';
import { expenseCategoryLabels } from '../../services/vehicle/expenseCopy';
import { getActiveVehicle } from '../../services/vehicle/activeVehicle';
import { useExpenseStore } from '../../store/expenseStore';
import { useVehicleStore } from '../../store/vehicleStore';
import { completeQuickAdd } from '../../navigation/completeQuickAdd';

type QuickAddOwnershipExpenseScreenProps = NativeStackScreenProps<RootStackParamList, 'OwnershipExpenseEntry'>;

export default function QuickAddOwnershipExpenseScreen({ navigation }: QuickAddOwnershipExpenseScreenProps) {
  const { vehicles, activeVehicleId } = useVehicleStore();
  const { createExpenseEntry } = useExpenseStore();
  const vehicle = getActiveVehicle(vehicles, activeVehicleId);
  const [state, dispatch] = useReducer(reduce, undefined, () => initialState(todayCalendarDate()));
  const saving = useRef(false);
  const { category, totalPaid, date, odometer, description } = state.input;
  const { showOptionalDetails } = state;
  const error = state.tag === 'editing' ? state.error : null;
  const isSaving = state.tag !== 'editing';
  const setError = (message: string) => dispatch({ type: 'error', message });

  if (!vehicle || activeVehicleId === null) {
    return (
      <View style={styles.empty}>
        <Text style={styles.title}>No active vehicle yet</Text>
        <Text style={styles.copy}>Choose a vehicle in Garage before recording an ownership expense.</Text>
      </View>
    );
  }

  const save = async () => {
    if (state.tag !== 'editing' || saving.current) return;
    const result = validateExpenseEntryForm({
      category,
      totalPaid,
      date,
      odometer,
      description,
    });
    if (!result.ok) return setError(result.error);

    saving.current = true;
    dispatch({ type: 'save' });
    try {
      await createExpenseEntry({ ...result.value, vehicleId: activeVehicleId });
      dispatch({ type: 'saved' });
      completeQuickAdd(navigation);
    } catch {
      setError('Unable to save this ownership expense. Please try again.');
    } finally {
      saving.current = false;
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Add ownership expense</Text>
      <Text style={styles.copy}>Record a payment such as insurance, tax, parking, or tolls.</Text>
      <QuickAddVehicleContext vehicle={vehicle} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.label}>Category</Text>
      <View style={styles.categoryGrid}>
        {Object.values(ExpenseCategory).map(option => (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityLabel={expenseCategoryLabels[option]}
            accessibilityState={{ selected: category === option }}
            style={[styles.category, category === option && styles.categorySelected]}
            disabled={isSaving}
            onPress={() => dispatch({ type: 'edit', field: 'category', value: option })}
          >
            <Text style={[styles.categoryText, category === option && styles.categoryTextSelected]}>
              {expenseCategoryLabels[option]}
            </Text>
          </Pressable>
        ))}
      </View>
      <QuickAddField
        label="Total paid"
        value={totalPaid}
        keyboardType="decimal-pad"
        editable={!isSaving}
        onChangeText={value => dispatch({ type: 'edit', field: 'totalPaid', value })}
      />
      <QuickAddField
        label="Date"
        placeholder="YYYY-MM-DD"
        value={date}
        editable={!isSaving}
        onChangeText={value => dispatch({ type: 'edit', field: 'date', value })}
      />
      {showOptionalDetails ? (
        <>
          <QuickAddField
            label="Odometer"
            optional
            value={odometer}
            keyboardType="number-pad"
            editable={!isSaving}
            onChangeText={value => dispatch({ type: 'edit', field: 'odometer', value })}
          />
          <QuickAddField
            label="Description"
            optional
            value={description}
            editable={!isSaving}
            onChangeText={value => dispatch({ type: 'edit', field: 'description', value })}
          />
        </>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add optional expense details"
          style={styles.optionalButton}
          disabled={isSaving}
          onPress={() => dispatch({ type: 'showOptionalDetails' })}
        >
          <Text style={styles.optionalButtonText}>Add optional details</Text>
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save ownership expense"
        disabled={isSaving}
        style={styles.button}
        onPress={() => {
          void save();
        }}
      >
        <Text style={styles.buttonText}>Save ownership expense</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Manage ownership expenses"
        style={styles.manageButton}
        onPress={() => navigation.navigate('OwnershipExpenses')}
      >
        <Text style={styles.manageButtonText}>Manage ownership expenses</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20, paddingBottom: 28 },
  empty: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f8fafc' },
  title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
  copy: { marginTop: 8, color: '#475569', lineHeight: 22 },
  label: { marginBottom: 8, color: '#334155', fontWeight: '600' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  category: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4ee',
  },
  categorySelected: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  categoryText: { color: '#334155', fontSize: 14 },
  categoryTextSelected: { color: '#ffffff' },
  error: { marginBottom: 12, color: '#b91c1c', lineHeight: 20 },
  optionalButton: { alignSelf: 'flex-start', marginBottom: 12, paddingVertical: 8 },
  optionalButtonText: { color: '#2563eb', fontWeight: '600' },
  button: { marginTop: 8, backgroundColor: '#0f172a', borderRadius: 16, alignItems: 'center', paddingVertical: 15 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  manageButton: { alignItems: 'center', paddingVertical: 14 },
  manageButtonText: { color: '#2563eb', fontWeight: '600' },
});
