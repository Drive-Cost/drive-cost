export type AccountFormInput = {
  email: string;
  password: string;
  confirmation: string;
};

export function validateAccountCreation(input: AccountFormInput): string | null {
  if (!/^\S+@\S+\.\S+$/.test(input.email.trim())) return 'Enter a valid email address.';
  if (input.password.length < 12) return 'Use at least 12 characters for your password.';
  if (input.password !== input.confirmation) return 'Passwords do not match.';
  return null;
}

export function accountCreationErrorMessage(error: unknown): string {
  const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined;
  switch (status) {
    case 409:
      return 'An account with this email already exists.';
    case 429:
      return 'Too many attempts. Try again shortly.';
    case 400:
      return 'Check your details and try again.';
    default:
      return 'DriveCost couldn’t reach the service. Your local data is safe.';
  }
}
