import { Vehicle } from '../models/Vehicle';
import { todayCalendarDate } from './entryDate';

/** New vehicles begin tracking on the device's local calendar date. */
export function initializeVehicleTrackingStartDate(vehicle: Vehicle, now = new Date()): Vehicle {
    return { ...vehicle, trackingStartDate: vehicle.trackingStartDate ?? todayCalendarDate(now) };
}
