import { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useVehicleStore } from '../store/vehicleStore';
import { GarageStackParamList } from '../navigation/types';

type GarageScreenProps = NativeStackScreenProps<GarageStackParamList, 'GarageHome'>;

export default function GarageScreen({ navigation }: GarageScreenProps) {
    const { vehicles, loadVehicles, setActiveVehicle, activeVehicleId } = useVehicleStore();

    useEffect(() => {
        loadVehicles();
    }, [loadVehicles]);

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <Text style={styles.title}>Your garage</Text>
                <Text style={styles.subtitle}>Choose the car you want DriveCost to track.</Text>
            </View>

            <Pressable style={styles.addButton} onPress={() => navigation.navigate('AddVehicle')}>
                <Text style={styles.addButtonText}>Add vehicle</Text>
            </Pressable>

            <FlatList
                data={vehicles}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={vehicles.length === 0 ? styles.emptyList : styles.list}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                ListEmptyComponent={
                    <View style={styles.emptyCard}>
                        <Text style={styles.emptyTitle}>No vehicles yet</Text>
                        <Text style={styles.emptyText}>
                            Start with one car and keep everything local while we shape the first version.
                        </Text>
                    </View>
                }
                renderItem={({ item }) => {
                    if (item.id === undefined) return null;
                    const vehicleId = item.id;

                    return (
                        <View style={[styles.vehicleCard, vehicleId === activeVehicleId && styles.vehicleCardActive]}>
                            <Pressable onPress={() => setActiveVehicle(vehicleId)}>
                                <Text style={styles.vehicleName}>{item.label || `${item.brand} ${item.model}`}</Text>
                                <Text style={styles.vehicleMeta}>
                                    {item.brand} {item.model} • {item.year}
                                </Text>
                                {item.fuelType || item.engine || item.powerHp || item.transmission ? (
                                    <Text style={styles.vehicleSpec}>
                                        {[
                                            item.fuelType,
                                            item.engine,
                                            item.powerHp ? `${item.powerHp} hp` : null,
                                            item.transmission,
                                        ]
                                            .filter(Boolean)
                                            .join(' • ')}
                                    </Text>
                                ) : null}
                                <Text style={styles.vehicleMeta}>Odometer {item.currentOdometer.toLocaleString()} km</Text>
                                <Text style={styles.vehicleMeta}>
                                    Ownership start {item.ownershipStartMileage.toLocaleString()} km
                                </Text>
                                <Text style={styles.vehicleMeta}>
                                    Tracking start {item.trackingStartMileage.toLocaleString()} km
                                </Text>
                                {vehicleId === activeVehicleId ? <Text style={styles.activeTag}>Active vehicle</Text> : null}
                            </Pressable>

                            <View style={styles.cardActions}>
                                <Pressable style={styles.secondaryButton} onPress={() => setActiveVehicle(vehicleId)}>
                                    <Text style={styles.secondaryButtonText}>Set active</Text>
                                </Pressable>

                                <Pressable
                                    style={styles.secondaryButton}
                                    onPress={() => navigation.navigate('EditVehicle', { vehicleId })}
                                >
                                    <Text style={styles.secondaryButtonText}>Edit</Text>
                                </Pressable>
                            </View>
                        </View>
                    );
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, padding: 20, backgroundColor: '#f8fafc' },
    header: { marginBottom: 16 },
    title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
    subtitle: { marginTop: 6, fontSize: 15, color: '#475569' },
    addButton: {
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: 'center',
        backgroundColor: '#0f172a',
        marginBottom: 18,
    },
    addButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
    list: { paddingBottom: 20 },
    emptyList: { flexGrow: 1, justifyContent: 'center' },
    separator: { height: 12 },
    emptyCard: { padding: 20, borderRadius: 20, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0' },
    emptyTitle: { fontSize: 20, fontWeight: '600', color: '#0f172a' },
    emptyText: { marginTop: 8, color: '#475569', lineHeight: 22 },
    vehicleCard: { padding: 18, borderRadius: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0' },
    vehicleCardActive: { borderColor: '#0ea5e9', backgroundColor: '#f0f9ff' },
    vehicleName: { fontSize: 18, fontWeight: '600', color: '#0f172a' },
    vehicleMeta: { marginTop: 6, color: '#475569' },
    vehicleSpec: { marginTop: 8, color: '#334155', lineHeight: 20 },
    activeTag: { marginTop: 10, color: '#0369a1', fontWeight: '600' },
    cardActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
    secondaryButton: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#e2e8f0' },
    secondaryButtonText: { color: '#0f172a', fontWeight: '600' },
});
