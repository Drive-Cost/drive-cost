import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { validateVehicleForm, VehicleFormInput } from '../../domain/formValidation';
import { Vehicle } from '../../models/Vehicle';

export const VehicleFormMode = { Create: 'create', Edit: 'edit' } as const;

type VehicleFormMode = (typeof VehicleFormMode)[keyof typeof VehicleFormMode];
type ValidatedVehicle = Omit<Vehicle, 'id' | 'clientId'>;
type VehicleTextFieldDefinition = {
    field: keyof VehicleFormInput;
    placeholder: string;
    keyboardType?: 'default' | 'number-pad';
};

const VEHICLE_DETAILS_FIELDS: readonly VehicleTextFieldDefinition[] = [
    { field: 'label', placeholder: 'Custom label (optional)' },
    { field: 'brand', placeholder: 'Brand' },
    { field: 'model', placeholder: 'Model' },
    { field: 'year', placeholder: 'Year', keyboardType: 'number-pad' },
    { field: 'fuelType', placeholder: 'Fuel type (Diesel, Petrol, EV...)' },
    { field: 'engine', placeholder: 'Engine (optional)' },
    { field: 'powerHp', placeholder: 'Power in hp (optional)', keyboardType: 'number-pad' },
    { field: 'transmission', placeholder: 'Transmission (optional)' },
];

const CREATE_MILEAGE_FIELD: VehicleTextFieldDefinition = {
    field: 'currentOdometer',
    placeholder: 'Starting odometer',
    keyboardType: 'number-pad',
};

const EDIT_MILEAGE_FIELDS: readonly VehicleTextFieldDefinition[] = [
    { field: 'ownershipStartMileage', placeholder: 'Ownership start mileage', keyboardType: 'number-pad' },
    { field: 'trackingStartMileage', placeholder: 'Tracking start mileage', keyboardType: 'number-pad' },
    { field: 'currentOdometer', placeholder: 'Current odometer', keyboardType: 'number-pad' },
];

interface VehicleFormProps {
    mode: VehicleFormMode;
    initialVehicle?: Vehicle;
    submitLabel: string;
    onSubmit: (vehicle: ValidatedVehicle) => Promise<void>;
}

export function VehicleForm({ mode, initialVehicle, submitLabel, onSubmit }: VehicleFormProps) {
    const [input, setInput] = useState(() => toFormInput(initialVehicle));
    const [error, setError] = useState<string | null>(null);
    const isCreate = mode === VehicleFormMode.Create;

    const update = (field: keyof VehicleFormInput, value: string) => {
        setInput((current) => ({ ...current, [field]: value }));
    };

    const updateStartingOdometer = (value: string) => {
        setInput((current) => ({
            ...current,
            ownershipStartMileage: value,
            trackingStartMileage: value,
            currentOdometer: value,
        }));
    };

    const handleSubmit = async () => {
        const result = validateVehicleForm(input);
        if (!result.ok) {
            setError(result.error);
            return;
        }

        await onSubmit(result.value);
    };

    return (
        <View>
            {error ? <Text style={styles.error}>{error}</Text> : null}

            {VEHICLE_DETAILS_FIELDS.map((field) => (
                <VehicleTextField
                    key={field.field}
                    {...field}
                    value={input[field.field]}
                    onChangeText={(value) => update(field.field, value)}
                />
            ))}

            {isCreate ? (
                <VehicleTextField
                    {...CREATE_MILEAGE_FIELD}
                    value={input.currentOdometer}
                    onChangeText={updateStartingOdometer}
                />
            ) : (
                EDIT_MILEAGE_FIELDS.map((field) => (
                    <VehicleTextField
                        key={field.field}
                        {...field}
                        value={input[field.field]}
                        onChangeText={(value) => update(field.field, value)}
                    />
                ))
            )}

            <Pressable style={styles.button} onPress={handleSubmit}>
                <Text style={styles.buttonText}>{submitLabel}</Text>
            </Pressable>
        </View>
    );
}

function VehicleTextField({
    placeholder,
    value,
    keyboardType,
    onChangeText,
}: {
    placeholder: string;
    value: string;
    keyboardType?: 'default' | 'number-pad';
    onChangeText: (value: string) => void;
}) {
    return (
        <TextInput
            placeholder={placeholder}
            placeholderTextColor="#94a3b8"
            style={styles.input}
            value={value}
            keyboardType={keyboardType}
            onChangeText={onChangeText}
        />
    );
}

function toFormInput(vehicle?: Vehicle): VehicleFormInput {
    return {
        brand: vehicle?.brand ?? '',
        model: vehicle?.model ?? '',
        year: vehicle ? String(vehicle.year) : '',
        label: vehicle?.label ?? '',
        fuelType: vehicle?.fuelType ?? '',
        engine: vehicle?.engine ?? '',
        powerHp: vehicle?.powerHp === undefined ? '' : String(vehicle.powerHp),
        transmission: vehicle?.transmission ?? '',
        ownershipStartMileage: vehicle ? String(vehicle.ownershipStartMileage) : '',
        trackingStartMileage: vehicle ? String(vehicle.trackingStartMileage) : '',
        currentOdometer: vehicle ? String(vehicle.currentOdometer) : '',
    };
}

const styles = StyleSheet.create({
    input: {
        backgroundColor: '#ffffff',
        borderColor: '#dbe4ee',
        borderWidth: 1,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        marginBottom: 12,
        color: '#0f172a',
    },
    error: { marginBottom: 12, color: '#b91c1c', lineHeight: 20 },
    button: { marginTop: 8, backgroundColor: '#0f172a', borderRadius: 16, alignItems: 'center', paddingVertical: 15 },
    buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
