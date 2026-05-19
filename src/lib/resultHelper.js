/**
 * Minimal local Result type (sipurai has no `better-result` dep).
 *
 * Mirrors the railway-oriented surface (Result.ok / Result.err / .isOk / .isErr)
 * so we can wrap 3rd-party AI fetch calls without leaking try/catch into business
 * logic. If/when better-result is added as a dep, swap imports — the API matches.
 *
 * Created 2026-05-14 for AI Studio smart-model routing.
 */

export class Result {
  constructor(ok, value, error) {
    this.isOk = ok;
    this.isErr = !ok;
    this._value = value;
    this._error = error;
  }

  static ok(value) {
    return new Result(true, value, undefined);
  }

  static err(error) {
    return new Result(false, undefined, error);
  }

  unwrap() {
    if (this.isErr) {
      throw this._error instanceof Error ? this._error : new Error(String(this._error));
    }
    return this._value;
  }

  unwrapOr(fallback) {
    return this.isOk ? this._value : fallback;
  }

  value() {
    return this._value;
  }

  error() {
    return this._error;
  }

  map(fn) {
    return this.isOk ? Result.ok(fn(this._value)) : this;
  }

  mapErr(fn) {
    return this.isErr ? Result.err(fn(this._error)) : this;
  }
}

/**
 * Wrap an async fetch-style call into a Result. Catches all thrown errors
 * and returns Result.err(Error). Use at 3rd-party API boundaries.
 *
 * @param {() => Promise<T>} fn
 * @returns {Promise<Result<T, Error>>}
 */
export async function safeAsync(fn) {
  try {
    const value = await fn();
    return Result.ok(value);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return Result.err(error);
  }
}
