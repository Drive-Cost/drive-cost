import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { addDuration, duration, instant, now } from '../../src/domain/time';
import type { Duration, Instant } from '../../src/domain/time';

describe('typed time values', () => {
    it('keeps an instant distinct from a duration in typed operations', () => {
        expectTypeOf<Instant>().not.toMatchTypeOf<Duration>();
        expectTypeOf<Duration>().not.toMatchTypeOf<Instant>();
        expectTypeOf(addDuration).parameter(0).toEqualTypeOf<Instant>();
        expectTypeOf(addDuration).parameter(1).toEqualTypeOf<Duration>();
        expectTypeOf(addDuration).returns.toEqualTypeOf<Instant>();
        expect(addDuration(instant(1_000), duration(250))).toBe(1_250);
    });

    it('checks values at construction and accepts sub-millisecond durations', () => {
        for (const invalid of [NaN, Infinity, -Infinity, Number.MAX_VALUE]) expect(() => instant(invalid)).toThrow();
        for (const invalid of [NaN, Infinity, -1]) expect(() => duration(invalid)).toThrow();
        expect(duration(0)).toBe(0);
        expect(duration(0.5)).toBe(0.5);
        expect(instant(-100)).toBe(-100); // Unix timestamps may precede the epoch.
        expect(() => addDuration(instant(Number.MAX_VALUE), duration(Number.MAX_VALUE))).toThrow();
    });

    it('constructs the current Unix instant from the wall clock', () => {
        const clock = vi.spyOn(Date, 'now').mockReturnValue(1_000);
        try {
            expect(now()).toBe(1_000);
        } finally {
            clock.mockRestore();
        }
    });
});
