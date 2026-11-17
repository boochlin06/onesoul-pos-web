/**
 * Pragmatic Result Pattern & Application Errors
 * Designed for edge runtimes (Cloudflare Workers / Hono)
 */

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown> | unknown[];

  constructor(
    code: string,
    message: string,
    statusCode: number = 400,
    details?: Record<string, unknown> | unknown[]
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // Restore prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown> | unknown[]) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class InvariantViolationError extends AppError {
  constructor(message: string, details?: Record<string, unknown> | unknown[]) {
    super('INVARIANT_VIOLATION', message, 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const msg = identifier
      ? `${resource} [${identifier}] not found`
      : `${resource} not found`;
    super('NOT_FOUND', msg, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown> | unknown[]) {
    super('CONFLICT', message, 409, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super('FORBIDDEN', message, 403);
  }
}

export class InsufficientStockError extends AppError {
  constructor(message: string, details?: Record<string, unknown> | unknown[]) {
    super('INSUFFICIENT_STOCK', message, 400, details);
  }
}

export class InsufficientPointsError extends AppError {
  constructor(message: string, details?: Record<string, unknown> | unknown[]) {
    super('INSUFFICIENT_POINTS', message, 400, details);
  }
}

export class OverdrawError extends AppError {
  constructor(message: string, details?: Record<string, unknown> | unknown[]) {
    super('OVERDRAW_ERROR', message, 400, details);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error', details?: Record<string, unknown> | unknown[]) {
    super('INTERNAL_SERVER_ERROR', message, 500, details);
  }
}

/**
 * Result Discriminated Union
 */
export type Result<T, E = AppError> = Ok<T> | Err<E>;

export interface Ok<T> {
  readonly success: true;
  readonly data: T;
  readonly error?: never;
}

export interface Err<E> {
  readonly success: false;
  readonly error: E;
  readonly data?: never;
}

/**
 * Creates a successful Result
 */
export function ok<T>(data: T): Ok<T> {
  return { success: true, data };
}

/**
 * Creates an error Result
 */
export function err<E = AppError>(error: E): Err<E> {
  return { success: false, error };
}

/**
 * Type guard for Ok
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.success === true;
}

/**
 * Type guard for Err
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result.success === false;
}

/**
 * Unwraps data or throws error
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.success) {
    return result.data;
  }
  if (result.error instanceof Error) {
    throw result.error;
  }
  throw new Error(String(result.error));
}

/**
 * Unwraps data or returns fallback value
 */
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  if (result.success) {
    return result.data;
  }
  return fallback;
}

/**
 * Map over successful value
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (val: T) => U
): Result<U, E> {
  if (result.success) {
    return ok(fn(result.data));
  }
  return result;
}

/**
 * Map over error value
 */
export function mapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  if (!result.success) {
    return err(fn(result.error));
  }
  return result;
}

/**
 * FlatMap / Chaining of Result
 */
export function andThen<T, U, E>(
  result: Result<T, E>,
  fn: (val: T) => Result<U, E>
): Result<U, E> {
  if (result.success) {
    return fn(result.data);
  }
  return result;
}

/**
 * Safely execute an asynchronous operation returning a Result
 */
export async function fromPromise<T, E = AppError>(
  promise: Promise<T>,
  errorTransformer?: (err: unknown) => E
): Promise<Result<T, E>> {
  try {
    const data = await promise;
    return ok(data);
  } catch (error) {
    if (errorTransformer) {
      return err(errorTransformer(error));
    }
    if (error instanceof AppError) {
      return err(error as unknown as E);
    }
    return err(new InternalServerError(error instanceof Error ? error.message : String(error)) as unknown as E);
  }
}
