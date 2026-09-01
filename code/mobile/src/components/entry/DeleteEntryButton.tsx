import { Alert, Pressable, StyleSheet, Text } from 'react-native';

const DELETE_TITLE = 'Delete entry?';
const DELETE_MESSAGE = 'This removes the entry from this vehicle and syncs the deletion to your devices.';
const DELETE_FAILURE_MESSAGE = 'Unable to delete this entry.';
const CANCEL_BUTTON_LABEL = 'Cancel';
const DELETE_BUTTON_LABEL = 'Delete';

interface DeleteEntryButtonProps {
    entryId: number | undefined;
    vehicleId: number | null;
    onDelete: (entryId: number, vehicleId: number) => Promise<void>;
    onError: (message: string) => void;
}

export function DeleteEntryButton({ entryId, vehicleId, onDelete, onError }: DeleteEntryButtonProps) {
    if (entryId === undefined || vehicleId === null) return null;

    const confirmDelete = () => {
        Alert.alert(DELETE_TITLE, DELETE_MESSAGE, [
            { text: CANCEL_BUTTON_LABEL, style: 'cancel' },
            {
                text: DELETE_BUTTON_LABEL,
                style: 'destructive',
                onPress: () => {
                    void onDelete(entryId, vehicleId).catch((error: unknown) => {
                        onError(error instanceof Error ? error.message : DELETE_FAILURE_MESSAGE);
                    });
                },
            },
        ]);
    };

    return (
        <Pressable accessibilityRole="button" onPress={confirmDelete}>
            <Text style={styles.label}>{DELETE_BUTTON_LABEL}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    label: { color: '#b91c1c', fontWeight: '600' },
});
