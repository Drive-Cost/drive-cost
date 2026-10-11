import { useReducer } from 'react';
import { initialState, reduce } from '../reducer';
import { useSubmissionGuard } from '../../../hooks/useSubmissionGuard';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { validateVehicleCreateForm, VehicleCreateFormInput } from '../../../domain/formValidation';
import { isSupportedVehicleType } from '../../../domain/vehicleType';
import { Vehicle } from '../../../models/Vehicle';
import { VehicleTextField } from '../../../components/vehicle/VehicleTextField';
import { VehicleTypeControl } from '../../../components/vehicle/VehicleTypeControl';
import { colors, control, radius, space } from '../../../shared/ui/tokens';

type NewVehicle = Omit<Vehicle, 'id' | 'clientId'>;

type CreateVehicleFormProps = {
  onSubmit: (vehicle: NewVehicle) => Promise<void>;
};

export function CreateVehicleForm({ onSubmit }: CreateVehicleFormProps) {
  const [state, dispatch] = useReducer(reduce, undefined, initialState);
  const { input } = state;
  const error = state.tag === 'editing' ? state.error : null;
  const isSaving = state.tag !== 'editing';
  const submitOnce = useSubmissionGuard();
  const update = (field: keyof VehicleCreateFormInput, value: string) => dispatch({ type: 'change', field, value });

  const handleSubmit = async () => {
    if (state.tag !== 'editing') return;
    const result = validateVehicleCreateForm(input);
    if (!result.ok) {
      dispatch({ type: 'error', message: result.error });
      return;
    }

    await submitOnce(async () => {
      dispatch({ type: 'save' });
      try {
        await onSubmit(result.value);
        dispatch({ type: 'saved' });
      } catch {
        dispatch({ type: 'error', message: 'Unable to add this vehicle. Please try again.' });
      }
    });
  };

  return (
    <View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <VehicleTextField
        editable={!isSaving}
        label="Brand"
        value={input.brand}
        onChangeText={value => update('brand', value)}
      />
      <VehicleTextField
        editable={!isSaving}
        label="Model"
        value={input.model}
        onChangeText={value => update('model', value)}
      />
      <VehicleTextField
        editable={!isSaving}
        label="Year"
        value={input.year}
        keyboardType="number-pad"
        onChangeText={value => update('year', value)}
      />
      <VehicleTypeControl
        disabled={isSaving}
        value={isSupportedVehicleType(input.vehicleType) ? input.vehicleType : undefined}
        onChange={vehicleType => update('vehicleType', vehicleType)}
      />
      <VehicleTextField
        editable={!isSaving}
        label="Current odometer"
        value={input.currentOdometer}
        keyboardType="number-pad"
        onChangeText={value => update('currentOdometer', value)}
      />
      <Text style={styles.hint}>DriveCost will start tracking from this odometer reading.</Text>
      <Pressable accessibilityRole="button" style={styles.button} disabled={isSaving} onPress={handleSubmit}>
        <Text style={styles.buttonText}>Start tracking</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  error: { marginBottom: space.md, color: colors.destructive, lineHeight: 20 },
  hint: { marginTop: -4, color: colors.mutedText, lineHeight: 20 },
  button: {
    minHeight: control.minHeight,
    marginTop: space.page,
    backgroundColor: colors.navy,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: colors.surface, fontSize: 16, fontWeight: '700' },
});
