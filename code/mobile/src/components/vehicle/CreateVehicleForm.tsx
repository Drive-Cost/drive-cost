import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { validateVehicleCreateForm, VehicleCreateFormInput } from '../../domain/formValidation';
import { isSupportedVehicleType } from '../../domain/vehicleType';
import { Vehicle } from '../../models/Vehicle';
import { VehicleTextField } from './VehicleTextField';
import { VehicleTypeControl } from './VehicleTypeControl';
import { colors, control, radius, space } from '../../shared/ui/tokens';

type NewVehicle = Omit<Vehicle, 'id' | 'clientId'>;

interface CreateVehicleFormProps {
    onSubmit: (vehicle: NewVehicle) => Promise<void>;
}

export function CreateVehicleForm({ onSubmit }: CreateVehicleFormProps) {
    const [input, setInput] = useState<VehicleCreateFormInput>({
        brand: '',
        model: '',
        year: '',
        vehicleType: '',
        currentOdometer: '',
    });
    const [error, setError] = useState<string | null>(null);

    const update = (field: keyof VehicleCreateFormInput, value: string) => {
        setInput((current) => ({ ...current, [field]: value }));
    };

    const handleSubmit = async () => {
        const result = validateVehicleCreateForm(input);
        if (!result.ok) {
            setError(result.error);
            return;
        }

        await onSubmit(result.value);
    };

    return (
        <View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <VehicleTextField label="Brand" value={input.brand} onChangeText={(value) => update('brand', value)} />
            <VehicleTextField label="Model" value={input.model} onChangeText={(value) => update('model', value)} />
            <VehicleTextField label="Year" value={input.year} keyboardType="number-pad" onChangeText={(value) => update('year', value)} />
            <VehicleTypeControl
                value={isSupportedVehicleType(input.vehicleType) ? input.vehicleType : undefined}
                onChange={(vehicleType) => update('vehicleType', vehicleType)}
            />
            <VehicleTextField
                label="Current odometer"
                value={input.currentOdometer}
                keyboardType="number-pad"
                onChangeText={(value) => update('currentOdometer', value)}
            />
            <Text style={styles.hint}>DriveCost will start tracking from this odometer reading.</Text>
            <Pressable accessibilityRole="button" style={styles.button} onPress={handleSubmit}>
                <Text style={styles.buttonText}>Start tracking</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    error: { marginBottom: space.md, color: colors.destructive, lineHeight: 20 },
    hint: { marginTop: -4, color: colors.mutedText, lineHeight: 20 },
    button: { minHeight: control.minHeight, marginTop: space.page, backgroundColor: colors.navy, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
    buttonText: { color: colors.surface, fontSize: 16, fontWeight: '700' },
});
