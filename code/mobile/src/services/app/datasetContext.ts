let generation = 0;
let resetting = false;
let accountBlocked = false;

export const getDatasetGeneration = () => generation;
export const isDatasetCurrent = (value: number) => generation === value;
export const isAccountContextBlocked = () => accountBlocked;
export function blockAccountContext(): void {
  accountBlocked = true;
}
export function releaseAccountContext(): void {
  accountBlocked = false;
}
export function blockDatasetWrites(): void {
  resetting = true;
}
export function beginDatasetReset(): void {
  generation += 1;
  resetting = true;
}
export function finishDatasetReset(): void {
  resetting = false;
}
export function assertDatasetCurrent(value: number): void {
  if (resetting || !isDatasetCurrent(value))
    throw new Error('Device records are being reset. Please try again afterward.');
}
export function assertAccountContext(): void {
  if (accountBlocked) throw new Error('Resolve account deletion in Settings before connecting an account.');
}
