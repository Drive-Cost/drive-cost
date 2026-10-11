import { useState } from 'react';
import { createSubmissionGuard } from '../services/app/submissionGuard';

/** Protects the interval before a disabled submit button renders. */
export function useSubmissionGuard() {
  const [guard] = useState(createSubmissionGuard);
  return guard;
}
