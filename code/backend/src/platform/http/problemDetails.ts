import type { ProblemDetails } from '@drivecost/contracts';

export const PROBLEM_DETAILS_MEDIA_TYPE = 'application/problem+json';

type ProblemCode = keyof typeof problemDefinitionByCode;

const STATUS_PROBLEMS: Partial<Record<number, ProblemCode>> = {
    401: 'unauthorized',
    429: 'rateLimited',
    500: 'internalError',
};

const problemDefinitionByCode = {
    invalidRequest: { status: 400, title: 'Invalid request', type: 'https://drivecost.app/problems/invalid-request' },
    unauthorized: {
        status: 401,
        title: 'Authentication required',
        type: 'https://drivecost.app/problems/unauthorized',
    },
    invalidCredentials: {
        status: 401,
        title: 'Invalid credentials',
        type: 'https://drivecost.app/problems/invalid-credentials',
    },
    guestUpgradeUnavailable: {
        status: 409,
        title: 'Guest account cannot be upgraded',
        type: 'https://drivecost.app/problems/guest-upgrade-unavailable',
    },
    rateLimited: { status: 429, title: 'Too many requests', type: 'https://drivecost.app/problems/rate-limited' },
    emailAlreadyRegistered: {
        status: 409,
        title: 'Email already registered',
        type: 'https://drivecost.app/problems/email-already-registered',
    },
    vehicleNotFound: {
        status: 409,
        title: 'Vehicle not found',
        type: 'https://drivecost.app/problems/vehicle-not-found',
    },
    invalidMileageBaseline: {
        status: 422,
        title: 'Invalid mileage baseline',
        type: 'https://drivecost.app/problems/invalid-mileage-baseline',
    },
    internalError: {
        status: 500,
        title: 'Internal server error',
        type: 'https://drivecost.app/problems/internal-error',
    },
} as const;

export const Problems = {
    invalidRequest: (detail?: string) => problem('invalidRequest', detail),
    unauthorized: (detail?: string) => problem('unauthorized', detail),
    invalidCredentials: (detail?: string) => problem('invalidCredentials', detail),
    guestUpgradeUnavailable: (detail?: string) => problem('guestUpgradeUnavailable', detail),
    rateLimited: (detail?: string) => problem('rateLimited', detail),
    emailAlreadyRegistered: (detail?: string) => problem('emailAlreadyRegistered', detail),
    vehicleNotFound: (id?: string) => problem('vehicleNotFound', id ? `Vehicle ${id} not found` : undefined),
    invalidMileageBaseline: (detail?: string) => problem('invalidMileageBaseline', detail),
    internalError: (detail?: string) => problem('internalError', detail),
} as const;

export class HttpProblem extends Error {
    readonly definition: (typeof problemDefinitionByCode)[ProblemCode];

    constructor(code: ProblemCode, detail?: string) {
        const definition = problemDefinitionByCode[code];
        super(detail ?? definition.title);
        this.name = 'HttpProblem';
        this.definition = definition;
    }
}

export function problem(code: ProblemCode, detail?: string): HttpProblem {
    return new HttpProblem(code, detail);
}

export function toProblemDetails(error: unknown, instance: string): ProblemDetails {
    const httpProblem = error instanceof HttpProblem ? error : problem('internalError');
    return {
        ...httpProblem.definition,
        ...(httpProblem.message !== httpProblem.definition.title ? { detail: httpProblem.message } : {}),
        instance,
    };
}

export function toHttpProblem(error: unknown): HttpProblem {
    if (error instanceof HttpProblem) {
        return error;
    }

    if (hasValidationError(error)) {
        return problem('invalidRequest');
    }

    const statusCode = getErrorStatusCode(error);
    if (statusCode && STATUS_PROBLEMS[statusCode]) {
        return problem(STATUS_PROBLEMS[statusCode]!);
    }

    return Problems.internalError();
}

function hasValidationError(error: unknown): error is { validation: unknown } {
    return typeof error === 'object' && error !== null && 'validation' in error && Boolean(error.validation);
}

function getErrorStatusCode(error: unknown): number | undefined {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) {
        return typeof error.statusCode === 'number' ? error.statusCode : undefined;
    }
    return undefined;
}
