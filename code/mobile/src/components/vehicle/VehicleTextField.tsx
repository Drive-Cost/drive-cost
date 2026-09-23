import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, space } from '../../shared/ui/tokens';

export function VehicleTextField({
    label,
    value,
    keyboardType,
    onChangeText,
}: {
    label: string;
    value: string;
    keyboardType?: 'default' | 'number-pad';
    onChangeText: (value: string) => void;
}) {
    return (
        <View style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
                accessibilityLabel={label}
                placeholder={label}
                placeholderTextColor="#94a3b8"
                style={styles.input}
                value={value}
                keyboardType={keyboardType}
                onChangeText={onChangeText}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    field: { marginBottom: space.md },
    label: { marginBottom: space.sm, color: colors.secondaryText, fontSize: 14, fontWeight: '600' },
    input: {
        minHeight: 48,
        backgroundColor: colors.surface,
        borderColor: colors.inputBorder,
        borderWidth: 1,
        borderRadius: radius.control,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        fontSize: 16,
        color: colors.text,
    },
});
