import { expect, it, vi } from 'vitest';
import { completeAccountDeletionNavigation } from '../../src/navigation/completeAccountDeletion';
import { primaryDestinations } from '../../src/navigation/primaryNavigation';
import { detailScreenHeaders } from '../../src/navigation/navigationShell';

it('returns deletion completion to Settings in the existing five-tab shell with no identity or secret parameters', () => {
  const reset = vi.fn();
  completeAccountDeletionNavigation({ reset });
  expect(reset).toHaveBeenCalledExactlyOnceWith({
    index: 0,
    routes: [{ name: 'PrimaryTabs', params: { screen: 'Settings' } }],
  });
  expect(primaryDestinations).toEqual(['Home', 'History', 'Add', 'Garage', 'Settings']);
  expect(detailScreenHeaders.DeleteAccount).toBe('Delete account');
});
