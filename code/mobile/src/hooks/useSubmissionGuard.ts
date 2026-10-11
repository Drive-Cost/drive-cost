import { useCallback, useRef } from 'react';

/** Protects the interval before a disabled submit button renders. */
export function useSubmissionGuard() {
  const active = useRef(false);
  return useCallback(async (submit: () => Promise<void>): Promise<void> => {
    if (active.current) return;
    active.current = true;
    try {
      await submit();
    } finally {
      active.current = false;
    }
  }, []);
}
