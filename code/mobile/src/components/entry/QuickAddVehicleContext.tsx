import { StyleSheet, Text, View } from 'react-native';
import { Vehicle } from '../../models/Vehicle';
import { colors, radius, space } from '../../shared/ui/tokens';

export function QuickAddVehicleContext({ vehicle }: { vehicle: Vehicle }) {
    return (
        <View style={styles.card}>
            <Text style={styles.label}>Logging for</Text>
            <Text style={styles.name}>{vehicle.label || `${vehicle.brand} ${vehicle.model}`}</Text>
            <Text style={styles.detail}>Current odometer: {vehicle.currentOdometer.toLocaleString()} km</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    card: { marginTop: space.lg, marginBottom: 18, padding: space.md, borderRadius: radius.control, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    label: { color: colors.mutedText, fontSize: 13, fontWeight: '600' },
    name: { marginTop: 3, color: colors.text, fontSize: 17, fontWeight: '700' },
    detail: { marginTop: space.xs, color: colors.secondaryText },
});
