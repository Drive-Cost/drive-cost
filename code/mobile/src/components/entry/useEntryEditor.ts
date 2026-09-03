import { useCallback, useState } from 'react';

interface EditableEntry {
    id?: number;
    vehicleId: number;
}

export type EntryForm = Record<string, string>;

export function useEntryEditor<Entry extends EditableEntry>(
    createEmptyForm: () => EntryForm,
    toFormInput: (entry: Entry) => EntryForm,
) {
    const [formInput, setFormInput] = useState(createEmptyForm);
    const [editingEntry, setEditingEntry] = useState<Entry | null>(null);

    const updateFormInput = useCallback((field: string, value: string) => {
        setFormInput((current) => ({ ...current, [field]: value }));
    }, []);

    const clearEditor = useCallback(() => {
        setFormInput(createEmptyForm());
        setEditingEntry(null);
    }, [createEmptyForm]);

    const startEditing = useCallback(
        (entry: Entry) => {
            setFormInput(toFormInput(entry));
            setEditingEntry(entry);
        },
        [toFormInput],
    );

    const cancelIfVehicleChanged = useCallback(
        (vehicleId: number | null) => {
            if (editingEntry && editingEntry.vehicleId !== vehicleId) clearEditor();
        },
        [clearEditor, editingEntry],
    );

    const clearIfEditing = useCallback(
        (entryId: number) => {
            if (editingEntry?.id === entryId) clearEditor();
        },
        [clearEditor, editingEntry],
    );

    return {
        formInput,
        editingEntry,
        updateFormInput,
        clearEditor,
        startEditing,
        cancelIfVehicleChanged,
        clearIfEditing,
    };
}
