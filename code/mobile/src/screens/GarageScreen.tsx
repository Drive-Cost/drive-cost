import { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useVehicleStore } from '../store/vehicleStore';
import { GarageStackParamList } from '../navigation/types';
import { getGarageVehiclePresentation } from '../services/vehicle/garageVehiclePresentation';

type GarageScreenProps = NativeStackScreenProps<GarageStackParamList, 'GarageHome'>;

export default function GarageScreen({ navigation }: GarageScreenProps) {
    const { vehicles, loadVehicles, setActiveVehicle, activeVehicleId } = useVehicleStore();

    useEffect(() => {
        loadVehicles();
    }, [loadVehicles]);

    return (
        <SafeAreaView edges={['top']} style={styles.screen}>
            <View style={styles.header}>
                <Text style={styles.title}>Your garage</Text>
                <Text style={styles.subtitle}>Choose the vehicle you want to use in DriveCost.</Text>
            </View>

            {vehicles.length > 0 ? (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Add a vehicle"
                    style={styles.addButton}
                    onPress={() => navigation.navigate('AddVehicle')}
                >
                    <Ionicons name="add" size={19} color="#ffffff" />
                    <Text style={styles.addButtonText}>Add vehicle</Text>
                </Pressable>
            ) : null}

            <FlatList
                data={vehicles}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={vehicles.length === 0 ? styles.emptyList : styles.list}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                ListEmptyComponent={
                    <View style={styles.emptyCard}>
                        <Text style={styles.emptyTitle}>No vehicles yet</Text>
                        <Text style={styles.emptyText}>
                            Add your first vehicle to start tracking.
                        </Text>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Add a vehicle"
                            style={styles.emptyAction}
                            onPress={() => navigation.navigate('AddVehicle')}
                        >
                            <Text style={styles.emptyActionText}>Add a vehicle</Text>
                        </Pressable>
                    </View>
                }
                renderItem={({ item }) => {
                    if (item.id === undefined) return null;
                    const vehicleId = item.id;

                    const presentation = getGarageVehiclePresentation(item, activeVehicleId);
                    return (
                        <View style={[styles.vehicleCard, presentation.isActive && styles.vehicleCardActive]}>
                            <Text style={styles.vehicleName}>{presentation.name}</Text>
                            {presentation.context ? <Text style={styles.vehicleContext}>{presentation.context}</Text> : null}
                            <Text style={styles.odometer}>{presentation.odometer}</Text>
                            <View style={styles.cardActions}>
                                {presentation.isActive ? (
                                    <Text accessibilityLabel={`${presentation.name} is the active vehicle`} style={styles.activeTag}>Active</Text>
                                ) : (
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={`Set ${presentation.name} as active`}
                                        hitSlop={6}
                                        style={styles.actionButton}
                                        onPress={() => setActiveVehicle(vehicleId)}
                                    >
                                        <Text style={styles.activateAction}>Set active</Text>
                                    </Pressable>
                                )}
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`Edit ${presentation.name}`}
                                    hitSlop={6}
                                    style={styles.actionButton}
                                    onPress={() => navigation.navigate('EditVehicle', { vehicleId })}
                                >
                                    <Text style={styles.editAction}>Edit</Text>
                                    <Ionicons name="chevron-forward" size={16} color="#475569" />
                                </Pressable>
                            </View>
                        </View>
                    );
                }}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, padding: 20, backgroundColor: '#f8fafc' },
    header: { marginBottom: 14 },
    title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
    subtitle: { marginTop: 6, fontSize: 15, color: '#475569' },
    addButton: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 13,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: '#0f172a',
        marginBottom: 16,
    },
    addButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
    list: { paddingBottom: 40 },
    emptyList: { flexGrow: 1, justifyContent: 'center' },
    separator: { height: 12 },
    emptyCard: { padding: 20, borderRadius: 16, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0' },
    emptyTitle: { fontSize: 20, fontWeight: '600', color: '#0f172a' },
    emptyText: { marginTop: 8, color: '#475569', lineHeight: 22 },
    emptyAction: { marginTop: 16, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#0f172a' },
    emptyActionText: { color: '#ffffff', fontWeight: '600' },
    vehicleCard: { padding: 18, borderRadius: 16, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0' },
    vehicleCardActive: { borderColor: '#cbd5e1' },
    vehicleName: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
    vehicleContext: { marginTop: 5, color: '#64748b', fontSize: 15 },
    odometer: { marginTop: 16, color: '#0f172a', fontSize: 22, fontWeight: '700' },
    cardActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
    activeTag: { color: '#0f172a', fontSize: 14, fontWeight: '700' },
    actionButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 4, justifyContent: 'center' },
    activateAction: { color: '#0f172a', fontWeight: '700' },
    editAction: { color: '#475569', fontWeight: '700' },
});
