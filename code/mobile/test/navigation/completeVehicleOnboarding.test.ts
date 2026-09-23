import { describe, expect, it, vi } from 'vitest';
import { completeVehicleOnboarding } from '../../src/navigation/completeVehicleOnboarding';

describe('completeVehicleOnboarding', () => {
    it('closes creation and takes the newly active vehicle to Home without requiring profile completion', () => {
        const popToTop = vi.fn();
        const navigate = vi.fn();

        completeVehicleOnboarding({ popToTop, getParent: () => ({ navigate }) } as never);

        expect(popToTop).toHaveBeenCalledOnce();
        expect(navigate).toHaveBeenCalledWith('Home');
    });
});
