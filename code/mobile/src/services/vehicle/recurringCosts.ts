import { toCalendarDate, parseCalendarDate } from '../../domain/entryDate';
import { RecurringExpense, isSupportedRecurringPeriod } from '../../models/RecurringExpense';
import { Vehicle } from '../../models/Vehicle';

export interface NormalizedRecurringCostCalculation {
    monthlyEquivalent: number | null;
    eligibleSchedules: RecurringExpense[];
    trackingPeriod: 'available' | 'tracking-start-date-unknown';
    asOfDate: string;
}

export function calculateNormalizedRecurringCost(
    vehicle: Vehicle,
    schedules: RecurringExpense[],
    asOfDate: string,
): NormalizedRecurringCostCalculation {
    const normalizedAsOfDate = validCalendarDate(asOfDate);
    const trackingStartDate = vehicle.trackingStartDate ?? null;
    if (trackingStartDate === null) {
        return { monthlyEquivalent: null, eligibleSchedules: [], trackingPeriod: 'tracking-start-date-unknown', asOfDate };
    }

    if (!normalizedAsOfDate || normalizedAsOfDate < trackingStartDate) {
        return { monthlyEquivalent: 0, eligibleSchedules: [], trackingPeriod: 'available', asOfDate };
    }

    const eligibleSchedules = schedules.filter((schedule) =>
        schedule.vehicleId === vehicle.id
        && schedule.active
        && Number.isFinite(schedule.amount)
        && schedule.amount > 0
        && isSupportedRecurringPeriod(schedule.periodMonths)
        && validCalendarDate(schedule.startDate) !== null
        && (validCalendarDate(schedule.startDate) as string) <= normalizedAsOfDate,
    );

    return {
        monthlyEquivalent: eligibleSchedules.reduce((total, schedule) => total + (schedule.amount / schedule.periodMonths), 0),
        eligibleSchedules,
        trackingPeriod: 'available',
        asOfDate: normalizedAsOfDate,
    };
}

export function monthlyEquivalent(schedule: Pick<RecurringExpense, 'amount' | 'periodMonths'>): number | null {
    return Number.isFinite(schedule.amount) && schedule.amount > 0 && isSupportedRecurringPeriod(schedule.periodMonths)
        ? schedule.amount / schedule.periodMonths
        : null;
}

function validCalendarDate(value: string): string | null {
    const date = toCalendarDate(value);
    return parseCalendarDate(date) ? date : null;
}
