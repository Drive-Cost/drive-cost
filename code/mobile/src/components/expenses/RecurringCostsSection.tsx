import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { validateRecurringExpenseForm } from '../../domain/formValidation';
import { toCalendarDate, todayCalendarDate } from '../../domain/entryDate';
import { ExpenseCategory } from '../../models/ExpenseEntry';
import { RecurringExpense, RecurringExpensePeriodMonths } from '../../models/RecurringExpense';
import { formatCurrency } from '../../services/vehicle/costCalculator';
import { expenseCategoryLabels, getExpenseCategoryLabel } from '../../services/vehicle/expenseCopy';
import { calculateNormalizedRecurringCost, monthlyEquivalent } from '../../services/vehicle/recurringCosts';
import { recurrenceAmountLabel, recurrenceLabels } from '../../services/vehicle/recurringExpenseCopy';
import { useRecurringExpenseStore } from '../../store/recurringExpenseStore';
import { Vehicle } from '../../models/Vehicle';
import { QuickAddField } from '../entry/QuickAddField';

type RecurringForm = { category: string; amount: string; periodMonths: string; startDate: string; nextDueDate: string; description: string };
const periods = RecurringExpensePeriodMonths;

export function RecurringCostsSection({ vehicle }: { vehicle: Vehicle }) {
    const { recurringExpenses, loadRecurringExpenses, createRecurringExpense, updateRecurringExpense, setRecurringExpenseActive, deleteRecurringExpense } = useRecurringExpenseStore();
    const [form, setForm] = useState<RecurringForm>(emptyForm);
    const [editing, setEditing] = useState<RecurringExpense | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => { if (vehicle.id) void loadRecurringExpenses(vehicle.id); }, [loadRecurringExpenses, vehicle.id]);
    const normalized = calculateNormalizedRecurringCost(vehicle, recurringExpenses, todayCalendarDate());
    const update = (field: keyof RecurringForm, value: string) => setForm((current) => ({ ...current, [field]: value }));

    const save = async () => {
        if (!vehicle.id) return;
        const result = validateRecurringExpenseForm(form);
        if (!result.ok) return setError(result.error);
        try {
            const schedule = { ...result.value, vehicleId: vehicle.id, active: editing?.active ?? true };
            if (editing) await updateRecurringExpense({ ...editing, ...schedule });
            else await createRecurringExpense(schedule);
            setForm(emptyForm()); setEditing(null); setError(null);
        } catch {
            setError('Unable to save this recurring cost. Please try again.');
        }
    };

    const startEditing = (schedule: RecurringExpense) => {
        setEditing(schedule);
        setForm({ category: schedule.category, amount: String(schedule.amount), periodMonths: String(schedule.periodMonths), startDate: toCalendarDate(schedule.startDate), nextDueDate: schedule.nextDueDate ? toCalendarDate(schedule.nextDueDate) : '', description: schedule.description ?? '' });
        setError(null);
    };

    return (
        <View style={styles.section}>
            <Text style={styles.title}>Recurring costs</Text>
            <Text style={styles.subtitle}>Active commitments are normalized for planning. They are not payments or tracked transaction costs.</Text>
            {normalized.monthlyEquivalent === null ? <Text style={styles.limited}>Set “Started tracking on” in Edit vehicle to calculate a tracked monthly equivalent.</Text> : <Text style={styles.monthly}>≈ {formatCurrency(normalized.monthlyEquivalent)}/month</Text>}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Text style={styles.label}>Category</Text>
            <View style={styles.grid}>{Object.values(ExpenseCategory).map((category) => <Choice key={category} selected={form.category === category} label={expenseCategoryLabels[category]} onPress={() => update('category', category)} />)}</View>
            <QuickAddField label="Amount per recurrence" placeholderTextColor="#94a3b8" value={form.amount} keyboardType="decimal-pad" onChangeText={(value) => update('amount', value)} />
            <Text style={styles.label}>Recurrence</Text>
            <View style={styles.grid}>{periods.map((period) => <Choice key={period} selected={form.periodMonths === String(period)} label={recurrenceLabels[period]} onPress={() => update('periodMonths', String(period))} />)}</View>
            <QuickAddField label="Start date" placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" value={form.startDate} onChangeText={(value) => update('startDate', value)} />
            <QuickAddField label="Next due date" optional placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" value={form.nextDueDate} onChangeText={(value) => update('nextDueDate', value)} />
            <QuickAddField label="Description" optional placeholderTextColor="#94a3b8" value={form.description} onChangeText={(value) => update('description', value)} />
            <Pressable style={styles.button} onPress={() => { void save(); }}><Text style={styles.buttonText}>{editing ? 'Update recurring cost' : 'Save recurring cost'}</Text></Pressable>
            {editing ? <Pressable style={styles.cancel} onPress={() => { setForm(emptyForm()); setEditing(null); }}><Text style={styles.cancelText}>Cancel edit</Text></Pressable> : null}
            <View style={styles.list}>
                {recurringExpenses.length === 0 ? <Text style={styles.empty}>No recurring costs yet.</Text> : recurringExpenses.map((schedule) => {
                    const equivalent = monthlyEquivalent(schedule);
                    return <View key={schedule.id ?? schedule.clientId} style={styles.item}>
                        <View style={styles.itemCopy}>
                            <Text style={styles.itemTitle}>{getExpenseCategoryLabel(schedule.category)}{schedule.active ? '' : ' · Inactive'}</Text>
                            <Text style={styles.itemMeta}>{formatCurrency(schedule.amount)} {recurrenceAmountLabel(schedule.periodMonths)}{equivalent === null ? '' : ` • ≈ ${formatCurrency(equivalent)}/month`}</Text>
                            <Text style={styles.itemMeta}>Starts {toCalendarDate(schedule.startDate)}{schedule.nextDueDate ? ` • Next due ${toCalendarDate(schedule.nextDueDate)}` : ''}</Text>
                        </View>
                        <View style={styles.actions}>
                            <Pressable onPress={() => startEditing(schedule)}><Text style={styles.edit}>Edit</Text></Pressable>
                            {schedule.id === undefined ? null : <Pressable onPress={() => { void setRecurringExpenseActive(schedule.id as number, vehicle.id as number, !schedule.active); }}><Text style={styles.toggle}>{schedule.active ? 'Deactivate' : 'Reactivate'}</Text></Pressable>}
                            {schedule.id === undefined ? null : <Pressable onPress={() => { void deleteRecurringExpense(schedule.id as number, vehicle.id as number); }}><Text style={styles.delete}>Delete</Text></Pressable>}
                        </View>
                    </View>;
                })}
            </View>
        </View>
    );
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
    return <Pressable style={[styles.choice, selected && styles.choiceSelected]} onPress={onPress}><Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text></Pressable>;
}

function emptyForm(): RecurringForm { return { category: '', amount: '', periodMonths: '', startDate: todayCalendarDate(), nextDueDate: '', description: '' }; }

const styles = StyleSheet.create({
    section: { marginTop: 20, padding: 18, borderRadius: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0' }, title: { fontSize: 18, fontWeight: '600', color: '#0f172a' }, subtitle: { marginTop: 4, color: '#64748b', lineHeight: 20 }, monthly: { marginTop: 12, color: '#0369a1', fontSize: 20, fontWeight: '700' }, limited: { marginTop: 12, color: '#b45309', lineHeight: 20 }, label: { marginTop: 16, marginBottom: 8, color: '#334155', fontWeight: '600' }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }, choice: { paddingVertical: 9, paddingHorizontal: 11, borderRadius: 14, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dbe4ee' }, choiceSelected: { backgroundColor: '#0f172a', borderColor: '#0f172a' }, choiceText: { color: '#334155', fontSize: 14 }, choiceTextSelected: { color: '#ffffff' }, error: { marginTop: 12, color: '#b91c1c' }, button: { marginTop: 4, backgroundColor: '#0f172a', borderRadius: 16, alignItems: 'center', paddingVertical: 14 }, buttonText: { color: '#ffffff', fontWeight: '600' }, cancel: { alignItems: 'center', paddingVertical: 12 }, cancelText: { color: '#2563eb', fontWeight: '600' }, list: { marginTop: 16 }, empty: { color: '#64748b' }, item: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingVertical: 12 }, itemCopy: { flex: 1, paddingRight: 12 }, itemTitle: { color: '#0f172a', fontWeight: '600' }, itemMeta: { marginTop: 4, color: '#475569', lineHeight: 19 }, actions: { alignItems: 'flex-end', gap: 8 }, edit: { color: '#2563eb', fontWeight: '600' }, toggle: { color: '#b45309', fontWeight: '600' }, delete: { color: '#b91c1c', fontWeight: '600' },
});
