import { Vehicle } from '../models/Vehicle';
import { todayCalendarDate } from './entryDate';

/** New vehicles begin tracking on the device's local calendar date. */
export function initializeVehicleTrackingStartDate<Input extends Omit<Vehicle, 'id' | 'clientId'>>(
  vehicle: Input,
  now = new Date()
): Omit<Input, 'trackingStartDate'> & { trackingStartDate: string } {
  return { ...vehicle, trackingStartDate: vehicle.trackingStartDate ?? todayCalendarDate(now) };
}
