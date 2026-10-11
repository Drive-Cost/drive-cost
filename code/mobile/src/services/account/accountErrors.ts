export class AccountOwnershipError extends Error {}
export class AccountDataError extends AccountOwnershipError {}
export class AccountActivationError extends AccountDataError {}
