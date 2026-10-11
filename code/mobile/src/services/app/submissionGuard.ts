export function createSubmissionGuard() {
  let active = false;
  return async (submit: () => Promise<void>): Promise<void> => {
    if (active) return;
    active = true;
    try {
      await submit();
    } finally {
      active = false;
    }
  };
}
