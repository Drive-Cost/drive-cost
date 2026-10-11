import { useState } from 'react';
import { useSubmissionGuard } from '../../hooks/useSubmissionGuard';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { entryErrorMessage, ENTRY_DELETE_FAILURE_MESSAGE } from '../../services/entries/entryError';
import { colors } from '../../shared/ui/tokens';

const DELETE_TITLE = 'Delete entry?';
const DELETE_MESSAGE = 'This removes the entry from this vehicle.';
const CANCEL_BUTTON_LABEL = 'Cancel';
const DELETE_BUTTON_LABEL = 'Delete';

type DeleteEntryButtonProps = {
  disabled?: boolean;
  entryId: number;
  vehicleId: number | null;
  onDelete: (entryId: number, vehicleId: number) => Promise<void>;
  onError: (message: string) => void;
};

export function DeleteEntryButton({ entryId, vehicleId, onDelete, onError, disabled = false }: DeleteEntryButtonProps) {
  const submitOnce = useSubmissionGuard();
  const [deleting, setDeleting] = useState(false);
  if (vehicleId === null) return null;

  const confirmDelete = () => {
    Alert.alert(DELETE_TITLE, DELETE_MESSAGE, [
      { text: CANCEL_BUTTON_LABEL, style: 'cancel' },
      {
        text: DELETE_BUTTON_LABEL,
        style: 'destructive',
        onPress: () => {
          void submitOnce(async () => {
            setDeleting(true);
            try {
              await onDelete(entryId, vehicleId);
            } catch (error) {
              onError(entryErrorMessage(error, ENTRY_DELETE_FAILURE_MESSAGE));
            } finally {
              setDeleting(false);
            }
          });
        },
      },
    ]);
  };

  return (
    <Pressable
      disabled={disabled || deleting}
      accessibilityState={{ disabled: disabled || deleting, busy: deleting }}
      accessibilityRole="button"
      onPress={confirmDelete}
    >
      <Text style={styles.label}>{DELETE_BUTTON_LABEL}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.destructive, fontWeight: '700' },
});
