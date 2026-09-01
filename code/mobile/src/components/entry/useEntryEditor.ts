import { useCallback, useState } from 'react';

interface EditableEntry {
    id?: number;
    vehicleId: number;
}

export function useEntryEditor<
    Entry extends EditableEntry,
    FormInput extends { [Field in keyof FormInput]: string },
>(
    emptyForm: FormInput,
    toFormInput: (entry: Entry) => FormInput,
) {
    const [formInput, setFormInput] = useState(emptyForm);
    const [editingEntry, setEditingEntry] = useState<Entry | null>(null);

    const updateFormInput = useCallback(<Field extends keyof FormInput>(field: Field, value: FormInput[Field]) => {
        setFormInput((current) => ({ ...current, [field]: value }));
    }, []);

    const clearEditor = useCallback(() => {
        setFormInput(emptyForm);
        setEditingEntry(null);
    }, [emptyForm]);

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
