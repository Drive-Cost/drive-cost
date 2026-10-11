import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../../shared/ui/tokens';

const EDIT_BUTTON_LABEL = 'Edit';

type EditEntryButtonProps = {
  disabled?: boolean;
  onPress: () => void;
};

export function EditEntryButton({ onPress, disabled = false }: EditEntryButtonProps) {
  return (
    <Pressable disabled={disabled} accessibilityState={{ disabled }} accessibilityRole="button" onPress={onPress}>
      <Text style={styles.label}>{EDIT_BUTTON_LABEL}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.secondaryText, fontWeight: '700' },
});
