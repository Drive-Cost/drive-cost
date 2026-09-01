import { Pressable, StyleSheet, Text } from 'react-native';

const EDIT_BUTTON_LABEL = 'Edit';

interface EditEntryButtonProps {
    onPress: () => void;
}

export function EditEntryButton({ onPress }: EditEntryButtonProps) {
    return (
        <Pressable accessibilityRole="button" onPress={onPress}>
            <Text style={styles.label}>{EDIT_BUTTON_LABEL}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    label: { color: '#2563eb', fontWeight: '600' },
});
