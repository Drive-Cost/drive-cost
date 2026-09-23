import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, radius, space } from '../../shared/ui/tokens';

interface QuickAddFieldProps extends TextInputProps {
    label: string;
    optional?: boolean;
}

export function QuickAddField({ label, optional = false, style, ...inputProps }: QuickAddFieldProps) {
    return (
        <View style={styles.field}>
            <Text style={styles.label}>
                {label}{optional ? ' (optional)' : ''}
            </Text>
            <TextInput accessibilityLabel={label} style={[styles.input, style]} {...inputProps} />
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
        color: colors.text,
        fontSize: 16,
    },
});
