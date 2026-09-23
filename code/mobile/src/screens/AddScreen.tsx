import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ComponentProps } from 'react';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getAddActionOptions, getAddEmptyStateCopy, getVehicleCreationDestination } from '../navigation/primaryNavigation';
import { AppTabParamList, RootStackParamList } from '../navigation/types';
import { useVehicleStore } from '../store/vehicleStore';
import { getActiveVehicle } from '../services/vehicle/activeVehicle';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, control, radius, space } from '../shared/ui/tokens';

type AddScreenProps = CompositeScreenProps<
    BottomTabScreenProps<AppTabParamList, 'Add'>,
    NativeStackScreenProps<RootStackParamList, 'PrimaryTabs'>
>;

export default function AddScreen({ navigation }: AddScreenProps) {
    const { vehicles, activeVehicleId } = useVehicleStore();
    const vehicle = getActiveVehicle(vehicles, activeVehicleId);
    const actions = getAddActionOptions(vehicle);

    if (!vehicle) {
        const emptyState = getAddEmptyStateCopy();
        const creationDestination = getVehicleCreationDestination();
        return (
            <SafeAreaView edges={['top']} style={styles.emptyState}>
                <Text style={styles.title}>{emptyState.title}</Text>
                <Text style={styles.subtitle}>{emptyState.detail}</Text>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={emptyState.actionLabel}
                    style={styles.primaryButton}
                    onPress={() => navigation.navigate(creationDestination.tab, { screen: creationDestination.screen })}
                >
                    <Text style={styles.primaryButtonText}>{emptyState.actionLabel}</Text>
                </Pressable>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['top']} style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>Add to {vehicle.label || `${vehicle.brand} ${vehicle.model}`}</Text>
            <Text style={styles.subtitle}>Choose what you want to record.</Text>
            <View style={styles.actions}>
                {actions.map((action) => (
                    <Pressable
                        key={action.id}
                        accessibilityRole="button"
                        accessibilityLabel={action.title}
                        style={styles.action}
                        onPress={() => navigation.navigate(action.route)}
                    >
                        <View style={styles.actionIcon}>
                            <Ionicons name={actionIconName(action.id)} size={21} color={colors.navy} />
                        </View>
                        <View style={styles.actionCopy}>
                            <Text style={styles.actionTitle}>{action.title}</Text>
                            <Text style={styles.actionDetail}>{action.detail}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                    </Pressable>
                ))}
            </View>
        </ScrollView>
        </SafeAreaView>
    );
}

function actionIconName(action: string): ComponentProps<typeof Ionicons>['name'] {
    switch (action) {
        case 'fuel': return 'water-outline';
        case 'charging': return 'flash-outline';
        case 'maintenance': return 'construct-outline';
        case 'ownership-expense': return 'receipt-outline';
        default: return 'speedometer-outline';
    }
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: space.page, paddingBottom: control.pageBottom },
    emptyState: { flex: 1, justifyContent: 'center', padding: space.page, backgroundColor: colors.background },
    title: { fontSize: 28, fontWeight: '700', color: colors.text },
    subtitle: { marginTop: space.sm, color: colors.secondaryText, fontSize: 16, lineHeight: 23 },
    actions: { marginTop: space.section, borderTopWidth: 1, borderTopColor: colors.border },
    action: { minHeight: 76, flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    actionIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: space.md, borderRadius: 18, backgroundColor: '#f1f5f9' },
    actionCopy: { flex: 1, paddingRight: space.md },
    actionTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
    actionDetail: { marginTop: space.xs, color: colors.secondaryText, lineHeight: 20 },
    primaryButton: { minHeight: control.minHeight, marginTop: space.page, alignItems: 'center', justifyContent: 'center', borderRadius: radius.control, backgroundColor: colors.navy },
    primaryButtonText: { color: colors.surface, fontWeight: '700', fontSize: 16 },
});
