import { describe, it, expect } from 'vitest';
import {
  ok,
  err,
  isOk,
  isErr,
  unwrap,
  unwrapOr,
  map,
  mapErr,
  andThen,
  fromPromise,
  AppError,
  ValidationError,
  NotFoundError,
  InvariantViolationError,
  ConflictError,
} from '../src/result';

describe('Result Pattern', () => {
  it('should handle Ok values', () => {
    const res = ok({ id: '123', name: 'Goku GK' });
    expect(isOk(res)).toBe(true);
    expect(isErr(res)).toBe(false);
    expect(res.data.name).toBe('Goku GK');
    expect(unwrap(res)).toEqual({ id: '123', name: 'Goku GK' });
    expect(unwrapOr(res, { id: '0', name: 'fallback' })).toEqual({ id: '123', name: 'Goku GK' });
  });

  it('should handle Err values', () => {
    const error = new ValidationError('Invalid input');
    const res = err(error);
    expect(isOk(res)).toBe(false);
    expect(isErr(res)).toBe(true);
    if (isErr(res)) {
      expect(res.error.code).toBe('VALIDATION_ERROR');
      expect(res.error.statusCode).toBe(400);
    }
    expect(() => unwrap(res)).toThrow('Invalid input');
    expect(unwrapOr(res, 'default')).toBe('default');
  });

  it('should map over Ok', () => {
    const res = ok(10);
    const mapped = map(res, (x) => x * 2);
    expect(unwrap(mapped)).toBe(20);
  });

  it('should not map over Err', () => {
    const res = err(new NotFoundError('Product', 'GK-01'));
    const mapped = map(res, (x: number) => x * 2);
    expect(isErr(mapped)).toBe(true);
  });

  it('should mapErr over Err', () => {
    const res = err(new ValidationError('Bad phone'));
    const mapped = mapErr(res, (e) => new ConflictError(e.message));
    expect(isErr(mapped)).toBe(true);
    if (isErr(mapped)) {
      expect(mapped.error.code).toBe('CONFLICT');
    }
  });

  it('should chain with andThen', () => {
    const divide = (a: number, b: number) => {
      if (b === 0) return err(new AppError('DIV_ZERO', 'Cannot divide by zero', 400));
      return ok(a / b);
    };

    const res = andThen(ok(20), (val) => divide(val, 4));
    expect(unwrap(res)).toBe(5);

    const fail = andThen(ok(20), (val) => divide(val, 0));
    expect(isErr(fail)).toBe(true);
    if (isErr(fail)) {
      expect(fail.error.code).toBe('DIV_ZERO');
    }
  });

  it('should wrap async operations using fromPromise', async () => {
    const successPromise = Promise.resolve('ok_result');
    const resOk = await fromPromise(successPromise);
    expect(isOk(resOk)).toBe(true);
    expect(unwrap(resOk)).toBe('ok_result');

    const failPromise = Promise.reject(new InvariantViolationError('Sanity check'));
    const resErr = await fromPromise(failPromise);
    expect(isErr(resErr)).toBe(true);
    if (isErr(resErr)) {
      expect(resErr.error.code).toBe('INVARIANT_VIOLATION');
    }
  });
});
