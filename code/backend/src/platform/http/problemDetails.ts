import type { ProblemDetails } from '@drivecost/contracts';

export const PROBLEM_DETAILS_MEDIA_TYPE = 'application/problem+json';

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

type ProblemCode = keyof typeof problemDefinitionByCode;

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
