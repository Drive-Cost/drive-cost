const CALENDAR_DATE_FORMAT = 'YYYY-MM-DD';
const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const FIRST_MONTH = 1;
const LAST_MONTH = 12;
const FIRST_DAY = 1;

export const ENTRY_DATE_PLACEHOLDER = `Date (${CALENDAR_DATE_FORMAT})`;

export function parseCalendarDate(value: string): string | null {
    const match = CALENDAR_DATE_PATTERN.exec(value.trim());
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month < FIRST_MONTH || month > LAST_MONTH || day < FIRST_DAY) return null;

    const date = new Date(Date.UTC(year, month - FIRST_MONTH, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - FIRST_MONTH || date.getUTCDate() !== day) {
        return null;
    }
    return date.toISOString();
}

export function toCalendarDate(value: string): string {
    return value.slice(0, CALENDAR_DATE_FORMAT.length);
}

export function todayCalendarDate(now: Date = new Date()): string {
    return now.toISOString().slice(0, CALENDAR_DATE_FORMAT.length);
}
