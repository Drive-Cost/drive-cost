import { AdoptionProtocol } from '@drivecost/contracts';
import { Problems } from './problemDetails';

export function requestsAdoption(headers: Record<string, string | string[] | undefined>): boolean {
    const value = headers[AdoptionProtocol.header];
    if (value === undefined) return false;
    if (value !== AdoptionProtocol.version) throw Problems.invalidRequest();
    return true;
}
