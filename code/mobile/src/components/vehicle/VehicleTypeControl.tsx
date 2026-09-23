import { Pressable, StyleSheet, Text, View } from 'react-native';
import { VehicleTypeId, vehicleTypeOptions } from '../../domain/vehicleType';
import { colors, radius, space } from '../../shared/ui/tokens';

export function VehicleTypeControl({
    value,
    onChange,
}: {
    value?: VehicleTypeId;
    onChange: (value: VehicleTypeId) => void;
}) {
    return (
        <View style={styles.field}>
            <Text style={styles.label}>Vehicle type</Text>
            <View style={styles.options}>
                {vehicleTypeOptions.map((option) => {
                    const selected = option.id === value;

                    return (
                        <Pressable
                            key={option.id}
                            accessibilityRole="button"
                            accessibilityLabel={option.label}
                            accessibilityState={{ selected }}
                            style={[styles.option, selected && styles.optionSelected]}
                            onPress={() => onChange(option.id)}
                        >
                            <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    field: { marginBottom: space.lg },
    label: { marginBottom: space.sm, color: colors.secondaryText, fontSize: 14, fontWeight: '600' },
    options: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    option: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius.control, paddingHorizontal: space.md, paddingVertical: space.sm, backgroundColor: colors.surface },
    optionSelected: { borderColor: colors.navy, backgroundColor: colors.navy },
    optionText: { color: colors.secondaryText, fontWeight: '600' },
    optionTextSelected: { color: colors.surface },
});
