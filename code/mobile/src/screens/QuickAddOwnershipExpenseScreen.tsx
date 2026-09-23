import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { QuickAddField } from '../components/entry/QuickAddField';
import { QuickAddVehicleContext } from '../components/entry/QuickAddVehicleContext';
import { todayCalendarDate } from '../domain/entryDate';
import { validateExpenseEntryForm } from '../domain/formValidation';
import { ExpenseCategory } from '../models/ExpenseEntry';
import { RootStackParamList } from '../navigation/types';
import { expenseCategoryLabels } from '../services/vehicle/expenseCopy';
import { getActiveVehicle } from '../services/vehicle/activeVehicle';
import { useExpenseStore } from '../store/expenseStore';
import { useVehicleStore } from '../store/vehicleStore';
import { completeQuickAdd } from '../navigation/completeQuickAdd';

type QuickAddOwnershipExpenseScreenProps = NativeStackScreenProps<RootStackParamList, 'OwnershipExpenseEntry'>;

export default function QuickAddOwnershipExpenseScreen({ navigation }: QuickAddOwnershipExpenseScreenProps) {
    const { vehicles, activeVehicleId } = useVehicleStore();
    const { createExpenseEntry } = useExpenseStore();
    const vehicle = getActiveVehicle(vehicles, activeVehicleId);
    const [category, setCategory] = useState<ExpenseCategory | null>(null);
    const [totalPaid, setTotalPaid] = useState('');
    const [date, setDate] = useState(todayCalendarDate());
    const [odometer, setOdometer] = useState('');
    const [description, setDescription] = useState('');
    const [showOptionalDetails, setShowOptionalDetails] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!vehicle || activeVehicleId === null) {
        return <View style={styles.empty}><Text style={styles.title}>No active vehicle yet</Text><Text style={styles.copy}>Choose a vehicle in Garage before recording an ownership expense.</Text></View>;
    }

    const save = async () => {
        const result = validateExpenseEntryForm({
            category: category ?? '',
            totalPaid,
            date,
            odometer,
            description,
        });
        if (!result.ok) return setError(result.error);

        try {
            await createExpenseEntry({ ...result.value, vehicleId: activeVehicleId });
            setError(null);
            completeQuickAdd(navigation);
        } catch {
            setError('Unable to save this ownership expense. Please try again.');
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
                {Object.values(ExpenseCategory).map((option) => (
                    <Pressable
                        key={option}
                        accessibilityRole="button"
                        accessibilityLabel={expenseCategoryLabels[option]}
                        accessibilityState={{ selected: category === option }}
                        style={[styles.category, category === option && styles.categorySelected]}
                        onPress={() => setCategory(option)}
                    >
                        <Text style={[styles.categoryText, category === option && styles.categoryTextSelected]}>{expenseCategoryLabels[option]}</Text>
                    </Pressable>
                ))}
            </View>
            <QuickAddField label="Total paid" value={totalPaid} keyboardType="decimal-pad" onChangeText={setTotalPaid} />
            <QuickAddField label="Date" placeholder="YYYY-MM-DD" value={date} onChangeText={setDate} />
            {showOptionalDetails ? (
                <>
                    <QuickAddField label="Odometer" optional value={odometer} keyboardType="number-pad" onChangeText={setOdometer} />
                    <QuickAddField label="Description" optional value={description} onChangeText={setDescription} />
                </>
            ) : (
                <Pressable accessibilityRole="button" accessibilityLabel="Add optional expense details" style={styles.optionalButton} onPress={() => setShowOptionalDetails(true)}>
                    <Text style={styles.optionalButtonText}>Add optional details</Text>
                </Pressable>
            )}
            <Pressable accessibilityRole="button" accessibilityLabel="Save ownership expense" style={styles.button} onPress={() => { void save(); }}><Text style={styles.buttonText}>Save ownership expense</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Manage ownership expenses" style={styles.manageButton} onPress={() => navigation.navigate('OwnershipExpenses')}><Text style={styles.manageButtonText}>Manage ownership expenses</Text></Pressable>
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
    category: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dbe4ee' },
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
