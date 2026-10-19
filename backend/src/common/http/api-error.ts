/**
 * Body for Nest HTTP exceptions, e.g. `throw new ConflictException(apiError('EMAIL_TAKEN', '...'))`.
 * The global exception filter turns it into `{ error: { code, message, details? }, requestId }`.
 */
export interface ApiErrorBody {
  code: string;
  message: string;
  details?: string[];
}

export function apiError(code: string, message: string, details?: string[]): ApiErrorBody {
  return details ? { code, message, details } : { code, message };
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ApiErrorBody).code === 'string' &&
    typeof (value as ApiErrorBody).message === 'string'
  );
}
