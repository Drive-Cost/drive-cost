import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFuelStore } from '../store/fuelStore';
import { useVehicleStore } from '../store/vehicleStore';
import { formatCurrency } from '../services/vehicle/costCalculator';
import {
    getEnergyEntryLabel,
    getEnergyHistoryEmptyState,
    getEnergyHistoryTitle,
    getEnergyIntroCopy,
    getEnergyUnitLabel,
    isElectricVehicle,
} from '../services/vehicle/vehicleProfile';
import { validateEnergyEntryForm, validateFuelEntryForm, validateNewEntryOdometer } from '../domain/formValidation';
import { DeleteEntryButton } from '../components/entry/DeleteEntryButton';
import { EditEntryButton } from '../components/entry/EditEntryButton';
import { FuelEntry, FuelFillStatus } from '../models/FuelEntry';
import { useEntryEditor } from '../components/entry/useEntryEditor';
import type { EntryForm } from '../components/entry/useEntryEditor';
import { entryErrorMessage, ENTRY_SAVE_FAILURE_MESSAGE } from '../components/entry/entryError';
import { toCalendarDate, todayCalendarDate } from '../domain/entryDate';
import { energyTransactionCostLabel, fuelFillCopy } from '../services/vehicle/vehicleCopy';
import { QuickAddField } from '../components/entry/QuickAddField';
import { QuickAddVehicleContext } from '../components/entry/QuickAddVehicleContext';
import { RootStackParamList } from '../navigation/types';
import { completeQuickAdd } from '../navigation/completeQuickAdd';

function formatDate(value: string) {
    return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

type FuelScreenProps = NativeStackScreenProps<RootStackParamList, 'FuelEntry'>;

export default function FuelScreen({ navigation }: FuelScreenProps) {
    const { fuelEntries, createFuelEntry, updateFuelEntry, deleteFuelEntry, loadFuelEntries } = useFuelStore();
    const { vehicles, activeVehicleId, syncVehicleOdometer } = useVehicleStore();

    const [error, setError] = useState<string | null>(null);
    const {
        formInput,
        editingEntry,
        updateFormInput,
        clearEditor,
        startEditing,
        cancelIfVehicleChanged,
        clearIfEditing,
    } = useEntryEditor(createEmptyFuelForm, toFuelFormInput);

    const vehicle = vehicles.find((item) => item.id === activeVehicleId);
    const isElectric = isElectricVehicle(vehicle);
    const entryLabel = getEnergyEntryLabel(vehicle);
    const energyUnitLabel = getEnergyUnitLabel(vehicle);
    const activeFuelEntries = fuelEntries.filter((entry) => entry.vehicleId === activeVehicleId);

    useEffect(() => {
        if (!activeVehicleId) return;
        loadFuelEntries(activeVehicleId);
    }, [activeVehicleId, loadFuelEntries]);

    useEffect(() => {
        cancelIfVehicleChanged(activeVehicleId);
    }, [activeVehicleId, cancelIfVehicleChanged]);

    useEffect(() => {
        if (vehicle && !editingEntry && !formInput.odometer) {
            updateFormInput('odometer', String(vehicle.currentOdometer));
        }
    }, [editingEntry, formInput.odometer, updateFormInput, vehicle]);

    const handleDelete = async (entryId: number, vehicleId: number) => {
        await deleteFuelEntry(entryId, vehicleId);
        clearIfEditing(entryId);
    };

    const handleSaveFuel = async () => {
        if (!activeVehicleId) return;
        if (isElectric && !editingEntry) return;
        const input = {
            quantity: formInput.liters,
            price: formInput.price,
            odometer: formInput.odometer,
            date: formInput.date,
        };

        let values: { quantity: number; price: number; odometer: number; date: string };
        let resolvedFillStatus: FuelFillStatus;
        if (isElectric) {
            const result = validateEnergyEntryForm(input);
            if (!result.ok) {
                setError(result.error);
                return;
            }
            values = result.value;
            resolvedFillStatus = editingEntry?.fillStatus ?? FuelFillStatus.Unknown;
        } else {
            const fillStatus = validateFuelEntryForm({
                ...input,
                fillStatus: formInput.fillStatus,
            }, Boolean(editingEntry));
            if (!fillStatus.ok) {
                setError(fillStatus.error);
                return;
            }
            values = fillStatus.value;
            resolvedFillStatus = fillStatus.value.fillStatus;
        }

        if (!editingEntry && vehicle) {
            const odometer = validateNewEntryOdometer(values.odometer, vehicle.currentOdometer);
            if (!odometer.ok) {
                setError(odometer.error);
                return;
            }
        }

        try {
            if (editingEntry) {
                await updateFuelEntry({
                    ...editingEntry,
                    date: values.date,
                    liters: values.quantity,
                    price: values.price,
                    odometer: values.odometer,
                    fillStatus: resolvedFillStatus,
                });
            } else {
                await createFuelEntry({
                    vehicleId: activeVehicleId,
                    date: values.date,
                    liters: values.quantity,
                    price: values.price,
                    odometer: values.odometer,
                    fillStatus: resolvedFillStatus,
                });
            }
            await syncVehicleOdometer(activeVehicleId, values.odometer);

            clearEditor();
            setError(null);
            if (!editingEntry) completeQuickAdd(navigation);
        } catch (error) {
            setError(entryErrorMessage(error, ENTRY_SAVE_FAILURE_MESSAGE));
        }
    };

    const recentFuelEntries = [...activeFuelEntries].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 6);

    return (
        <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>{editingEntry ? (isElectric ? 'Edit legacy charge' : 'Edit fill-up') : 'Add fill-up'}</Text>
            <Text style={styles.subtitle}>
                {isElectric
                    ? 'Record new charging sessions in Charging. Existing entries remain available here for editing or deletion.'
                    : getEnergyIntroCopy(vehicle)}
            </Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {vehicle ? <QuickAddVehicleContext vehicle={vehicle} /> : null}

            {!isElectric || editingEntry ? (
                <>
                    <QuickAddField
                        label={isElectric ? 'Energy added (kWh)' : 'Litres'}
                        placeholderTextColor="#94a3b8"
                        value={formInput.liters}
                        keyboardType="decimal-pad"
                        onChangeText={(value) => updateFormInput('liters', value)}
                    />

                    <QuickAddField
                        label={energyTransactionCostLabel}
                        placeholderTextColor="#94a3b8"
                        value={formInput.price}
                        keyboardType="decimal-pad"
                        onChangeText={(value) => updateFormInput('price', value)}
                    />

                    <QuickAddField
                        label="Odometer"
                        placeholderTextColor="#94a3b8"
                        value={formInput.odometer}
                        keyboardType="number-pad"
                        onChangeText={(value) => updateFormInput('odometer', value)}
                    />

                    {!isElectric ? (
                        <View style={styles.fillStatusSection}>
                            <Text style={styles.fillStatusLabel}>{fuelFillCopy.question} (required)</Text>
                            <View style={styles.fillStatusOptions}>
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={fuelFillCopy.fullTank}
                                    accessibilityState={{ selected: formInput.fillStatus === FuelFillStatus.Full }}
                                    style={[
                                        styles.fillStatusButton,
                                        formInput.fillStatus === FuelFillStatus.Full && styles.fillStatusButtonSelected,
                                    ]}
                                    onPress={() => updateFormInput('fillStatus', FuelFillStatus.Full)}
                                >
                                    <Text style={styles.fillStatusButtonText}>{fuelFillCopy.fullTank}</Text>
                                </Pressable>
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={fuelFillCopy.partialFill}
                                    accessibilityState={{ selected: formInput.fillStatus === FuelFillStatus.Partial }}
                                    style={[
                                        styles.fillStatusButton,
                                        formInput.fillStatus === FuelFillStatus.Partial && styles.fillStatusButtonSelected,
                                    ]}
                                    onPress={() => updateFormInput('fillStatus', FuelFillStatus.Partial)}
                                >
                                    <Text style={styles.fillStatusButtonText}>{fuelFillCopy.partialFill}</Text>
                                </Pressable>
                            </View>
                            {!editingEntry && formInput.fillStatus === FuelFillStatus.Unknown ? (
                                <Text style={styles.fillStatusHint}>{fuelFillCopy.newEntryHint}</Text>
                            ) : null}
                        </View>
                    ) : null}

                    <QuickAddField
                        label="Date"
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor="#94a3b8"
                        value={formInput.date}
                        onChangeText={(value) => updateFormInput('date', value)}
                    />

                    <Pressable
                        style={[styles.button, !activeVehicleId && styles.buttonDisabled]}
                        accessibilityRole="button"
                        accessibilityLabel={editingEntry ? 'Save fill-up changes' : 'Save fill-up'}
                        disabled={!activeVehicleId}
                        onPress={handleSaveFuel}
                    >
                        <Text style={styles.buttonText}>
                            {editingEntry
                                ? `Update ${isElectric ? 'legacy charge' : entryLabel.toLowerCase()} entry`
                                : `Save ${entryLabel.toLowerCase()} entry`}
                        </Text>
                    </Pressable>
                </>
            ) : null}

            {editingEntry ? (
                <Pressable style={styles.secondaryButton} onPress={clearEditor}>
                    <Text style={styles.secondaryButtonText}>Cancel edit</Text>
                </Pressable>
            ) : null}

            {!activeVehicleId ? (
                <Text style={styles.helperText}>Select a vehicle in Garage before adding fuel costs.</Text>
            ) : null}

            <View style={styles.historyCard}>
                <Text style={styles.historyTitle}>{isElectric ? 'Legacy charge entries' : getEnergyHistoryTitle(vehicle)}</Text>
                <Text style={styles.historySubtitle}>
                    {isElectric
                        ? 'These existing entries remain included in your energy costs. New sessions belong in Charging.'
                        : 'Keep the habit simple: every new entry gives the dashboard more meaning.'}
                </Text>

                {recentFuelEntries.length === 0 ? (
                    <Text style={styles.emptyHistory}>
                        {isElectric ? 'No legacy charge entries to manage.' : getEnergyHistoryEmptyState(vehicle)}
                    </Text>
                ) : (
                    recentFuelEntries.map((entry) => {
                        return (
                            <View key={entry.id ?? `${entry.date}-${entry.odometer}`} style={styles.historyItem}>
                                <View style={styles.historyCopy}>
                                    <Text style={styles.historyPrimary}>
                                        {entry.liters.toFixed(1)} {energyUnitLabel}
                                    </Text>
                                    <Text style={styles.historyMeta}>
                                        {entry.odometer.toLocaleString()} km • {formatDate(entry.date)}
                                    </Text>
                                    {!isElectric ? (
                                        <Text style={styles.historyMeta}>{fillStatusLabel(entry.fillStatus)}</Text>
                                    ) : null}
                                </View>
                                <View style={styles.historyActions}>
                                    <Text style={styles.historyAmount}>{formatCurrency(entry.price)}</Text>
                                    <EditEntryButton
                                        onPress={() => {
                                            startEditing(entry);
                                            setError(null);
                                        }}
                                    />
                                    <DeleteEntryButton
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

function toFuelFormInput(entry: FuelEntry): EntryForm {
    return {
        date: toCalendarDate(entry.date),
        liters: String(entry.liters),
        price: String(entry.price),
        odometer: String(entry.odometer),
        fillStatus: entry.fillStatus,
    };
}

function createEmptyFuelForm(): EntryForm {
    return { date: todayCalendarDate(), liters: '', price: '', odometer: '', fillStatus: FuelFillStatus.Unknown };
}

function fillStatusLabel(fillStatus: FuelFillStatus): string {
    if (fillStatus === FuelFillStatus.Full) return fuelFillCopy.fullTank;
    if (fillStatus === FuelFillStatus.Partial) return fuelFillCopy.partialFill;
    return fuelFillCopy.unknown;
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#f8fafc' },
    content: { padding: 20, paddingBottom: 28 },
    title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
    subtitle: { marginTop: 8, marginBottom: 20, color: '#475569', lineHeight: 22 },
    snapshotCard: { marginBottom: 16, padding: 18, borderRadius: 18, backgroundColor: '#eff6ff' },
    snapshotLabel: { color: '#2563eb', fontSize: 14, marginBottom: 8 },
    snapshotValue: { color: '#1e3a8a', fontSize: 24, fontWeight: '700' },
    snapshotHint: { marginTop: 8, color: '#1d4ed8' },
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
    fillStatusSection: { marginBottom: 12 },
    fillStatusLabel: { color: '#334155', fontWeight: '600', marginBottom: 8 },
    fillStatusOptions: { flexDirection: 'row', gap: 10 },
    fillStatusButton: {
        flex: 1,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 12,
        paddingVertical: 12,
        backgroundColor: '#ffffff',
    },
    fillStatusButtonSelected: { borderColor: '#0f172a', backgroundColor: '#e0f2fe' },
    fillStatusButtonText: { color: '#0f172a', fontWeight: '600' },
    fillStatusHint: { marginTop: 8, color: '#64748b', lineHeight: 20 },
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
    historyMeta: { marginTop: 4, color: '#475569' },
    historyAmount: { color: '#0f172a', fontWeight: '600' },
    historyActions: { alignItems: 'flex-end', gap: 8 },
});
