import { FuelEntry, FuelFillStatus } from '../../models/FuelEntry';

export interface FuelConsumptionSource {
    clientId?: string;
    localId?: number;
}

export interface FuelConsumptionInterval {
    start: FuelConsumptionSource & { odometer: number };
    end: FuelConsumptionSource & { odometer: number };
    includedEntries: FuelConsumptionSource[];
    distanceKm: number;
    liters: number;
    litersPer100Km: number;
    chainId: number;
}

export interface FuelConsumptionAggregate {
    intervalCount: number;
    distanceKm: number;
    liters: number;
    litersPer100Km: number;
}

export interface FuelConsumptionCalculation {
    intervals: FuelConsumptionInterval[];
    latestInterval: FuelConsumptionInterval | null;
    aggregate: FuelConsumptionAggregate | null;
}

interface OpenFullTankBoundary {
    start: FuelEntry;
    includedEntries: FuelConsumptionSource[];
    liters: number;
    chainId: number;
}

export function calculateFuelConsumption(entries: FuelEntry[]): FuelConsumptionCalculation {
    const intervals: FuelConsumptionInterval[] = [];
    let openBoundary: OpenFullTankBoundary | null = null;
    let lastOdometer: number | null = null;
    let chainId = 0;

    for (const entry of chronological(entries)) {
        if (!isValidEntry(entry)) {
            openBoundary = null;
            lastOdometer = null;
            chainId += 1;
            continue;
        }

        if (lastOdometer !== null && entry.odometer < lastOdometer) {
            openBoundary = null;
            lastOdometer = entry.odometer;
            chainId += 1;
            continue;
        }
        lastOdometer = entry.odometer;

        if (entry.fillStatus === FuelFillStatus.Unknown) {
            openBoundary = null;
            chainId += 1;
            continue;
        }

        if (entry.fillStatus === FuelFillStatus.Partial) {
            if (openBoundary) {
                openBoundary.liters += entry.liters;
                openBoundary.includedEntries.push(toSource(entry));
            }
            continue;
        }

        if (openBoundary && entry.odometer > openBoundary.start.odometer) {
            intervals.push({
                start: { ...toSource(openBoundary.start), odometer: openBoundary.start.odometer },
                end: { ...toSource(entry), odometer: entry.odometer },
                includedEntries: [...openBoundary.includedEntries, toSource(entry)],
                distanceKm: entry.odometer - openBoundary.start.odometer,
                liters: openBoundary.liters + entry.liters,
                litersPer100Km: ((openBoundary.liters + entry.liters) / (entry.odometer - openBoundary.start.odometer)) * 100,
                chainId: openBoundary.chainId,
            });
            openBoundary = { start: entry, includedEntries: [], liters: 0, chainId };
            continue;
        }

        if (openBoundary) chainId += 1;
        openBoundary = { start: entry, includedEntries: [], liters: 0, chainId };
    }

    const latestInterval = intervals.at(-1) ?? null;
    const compatibleIntervals = latestInterval
        ? intervals.filter((interval) => interval.chainId === latestInterval.chainId)
        : [];
    const aggregate = aggregateIntervals(compatibleIntervals);

    return { intervals, latestInterval, aggregate };
}

function chronological(entries: FuelEntry[]): FuelEntry[] {
    return [...entries].sort((left, right) => {
        const dateOrder = left.date.localeCompare(right.date);
        if (dateOrder) return dateOrder;

        const localIdOrder = (left.id ?? Number.MAX_SAFE_INTEGER) - (right.id ?? Number.MAX_SAFE_INTEGER);
        if (localIdOrder) return localIdOrder;

        return (left.clientId ?? '').localeCompare(right.clientId ?? '');
    });
}

function isValidEntry(entry: FuelEntry): boolean {
    const validFillStatus = entry.fillStatus === FuelFillStatus.Full
        || entry.fillStatus === FuelFillStatus.Partial
        || entry.fillStatus === FuelFillStatus.Unknown;

    return Number.isFinite(entry.liters)
        && entry.liters > 0
        && Number.isSafeInteger(entry.odometer)
        && entry.odometer >= 0
        && validFillStatus;
}

function toSource(entry: FuelEntry): FuelConsumptionSource {
    return { clientId: entry.clientId, localId: entry.id };
}

function aggregateIntervals(intervals: FuelConsumptionInterval[]): FuelConsumptionAggregate | null {
    if (!intervals.length) return null;

    const distanceKm = intervals.reduce((sum, interval) => sum + interval.distanceKm, 0);
    const liters = intervals.reduce((sum, interval) => sum + interval.liters, 0);
    if (distanceKm <= 0) return null;

    return {
        intervalCount: intervals.length,
        distanceKm,
        liters,
        litersPer100Km: (liters / distanceKm) * 100,
    };
}
