import { useReducer } from 'react';
import { initialState, reduce } from '../reducer';
import { useSubmissionGuard } from '../../../hooks/useSubmissionGuard';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { validateVehicleForm, VehicleFormInput } from '../../../domain/formValidation';
import { Vehicle } from '../../../models/Vehicle';
import { fuelTypeForVehicleType, vehicleTypeForFuelType } from '../../../domain/vehicleType';
import { vehicleMileageCopy } from '../../../services/vehicle/vehicleCopy';
import { VehicleTextField } from '../../../components/vehicle/VehicleTextField';
import { VehicleTypeControl } from '../../../components/vehicle/VehicleTypeControl';
import { colors, control, radius, space } from '../../../shared/ui/tokens';

type ValidatedVehicle = Omit<Vehicle, 'id' | 'clientId'>;
type VehicleTextFieldDefinition = {
  field: keyof VehicleFormInput;
  label: string;
  keyboardType?: 'default' | 'number-pad';
};

const VEHICLE_DETAILS_FIELDS: readonly VehicleTextFieldDefinition[] = [
  { field: 'label', label: 'Custom label (optional)' },
  { field: 'brand', label: 'Brand' },
  { field: 'model', label: 'Model' },
  { field: 'year', label: 'Year', keyboardType: 'number-pad' },
  { field: 'engine', label: 'Engine (optional)' },
  { field: 'powerHp', label: 'Power in hp (optional)', keyboardType: 'number-pad' },
  { field: 'transmission', label: 'Transmission (optional)' },
];

const EDIT_MILEAGE_FIELDS: readonly VehicleTextFieldDefinition[] = [
  { field: 'ownershipStartMileage', label: vehicleMileageCopy.ownershipStartedAtLabel, keyboardType: 'number-pad' },
  { field: 'trackingStartMileage', label: vehicleMileageCopy.startTrackingFromLabel, keyboardType: 'number-pad' },
  { field: 'currentOdometer', label: vehicleMileageCopy.currentOdometerLabel, keyboardType: 'number-pad' },
];

const EDIT_TRACKING_DATE_FIELD: VehicleTextFieldDefinition = {
  field: 'trackingStartDate',
  label: 'Started tracking on (YYYY-MM-DD)',
};

type VehicleFormProps = {
  initialVehicle: Vehicle;
  submitLabel: string;
  onSubmit: (vehicle: ValidatedVehicle) => Promise<void>;
};

export function VehicleForm({ initialVehicle, submitLabel, onSubmit }: VehicleFormProps) {
  const [state, dispatch] = useReducer(reduce, undefined, () => initialState(toFormInput(initialVehicle)));
  const { input } = state;
  const error = state.tag === 'editing' ? state.error : null;
  const isSaving = state.tag !== 'editing';
  const submitOnce = useSubmissionGuard();
  const update = (field: keyof VehicleFormInput, value: string) => dispatch({ type: 'change', field, value });

  const handleSubmit = async () => {
    if (state.tag !== 'editing') return;
    const result = validateVehicleForm(input);
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
        dispatch({ type: 'error', message: 'Unable to save this vehicle. Please try again.' });
      }
    });
  };

  return (
    <View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {VEHICLE_DETAILS_FIELDS.map(field => (
        <VehicleTextField
          editable={!isSaving}
          key={field.field}
          {...field}
          value={input[field.field]}
          onChangeText={value => update(field.field, value)}
        />
      ))}

      <VehicleTypeControl
        disabled={isSaving}
        value={vehicleTypeForFuelType(input.fuelType)}
        onChange={vehicleType => update('fuelType', fuelTypeForVehicleType(vehicleType))}
      />

      {EDIT_MILEAGE_FIELDS.map(field => (
        <VehicleTextField
          editable={!isSaving}
          key={field.field}
          {...field}
          value={input[field.field]}
          onChangeText={value => update(field.field, value)}
        />
      ))}

      <VehicleTextField
        editable={!isSaving}
        {...EDIT_TRACKING_DATE_FIELD}
        value={input.trackingStartDate}
        onChangeText={value => update('trackingStartDate', value)}
      />

      <Pressable style={styles.button} disabled={isSaving} onPress={handleSubmit}>
        <Text style={styles.buttonText}>{submitLabel}</Text>
      </Pressable>
    </View>
  );
}

function toFormInput(vehicle: Vehicle): VehicleFormInput {
  return {
    brand: vehicle.brand,
    model: vehicle.model,
    year: String(vehicle.year),
    label: vehicle.label ?? '',
    fuelType: vehicle.fuelType ?? '',
    engine: vehicle.engine ?? '',
    powerHp: vehicle.powerHp === undefined ? '' : String(vehicle.powerHp),
    transmission: vehicle.transmission ?? '',
    ownershipStartMileage: String(vehicle.ownershipStartMileage),
    trackingStartMileage: String(vehicle.trackingStartMileage),
    trackingStartDate: vehicle.trackingStartDate ?? '',
    currentOdometer: String(vehicle.currentOdometer),
  };
}

const styles = StyleSheet.create({
  error: { marginBottom: space.md, color: colors.destructive, lineHeight: 20 },
  button: {
    minHeight: control.minHeight,
    marginTop: space.sm,
    backgroundColor: colors.navy,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: colors.surface, fontSize: 16, fontWeight: '700' },
});
