/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { IModelStatus } from "@itwin/core-bentley/lib/cjs/BentleyError";
import { IModelError } from "@itwin/core-common/lib/cjs/IModelError";

class ExpectedBase<T> {
  /**
   * Determines if this `Expected` is a successful result.
   *
   * This function works as a TypeScript type guard, so if it returns `true`, the type of the instance is
   * narrowed and it becomes possible to access the `value` property directly. If it returns `false`, the
   * `error` property can be accessed instead.
   */
  public isValue(this: Expected<T>): this is ExpectedValue<T> {
    return this instanceof ExpectedValue;
  }

  /**
   * Determines if this `Expected` is an error result.
   *
   * This function works as a TypeScript type guard, so if it returns `true`, the type of the instance is
   * narrowed and it becomes possible to access the `error` property directly. If it returns `false`, the
   * `value` property can be accessed instead.
   */
  public isError(this: Expected<T>): this is ExpectedError<T> {
    return this instanceof ExpectedError;
  }

  /**
   * Returns the successful value, if there is one, or the provided default value if this `Expected` is
   * an error. This function does not throw exceptions.
   */
  public valueOrDefault<U>(this: Expected<T>, defaultValue: U): T | U {
    return this.isValue() ? this.value : defaultValue;
  }

  /**
   * Returns the successful value, if there is one, or throws the error if this `Expected` is an error.
   */
  public valueOrThrow(this: Expected<T>): T {
    if (this.isError())
      throw this.error;
    return this.value;
  }

  /**
   * Maps the successful value of this `Expected` to a new value using the provided function. If this
   * `Expected` is an error, the same error is returned and the mapping function is not called.
   *
   * This function does not throw exceptions; if the mapping function throws an exception, it will
   * be captured and returned as an error in the resulting `Expected`.
   */
  public map<U>(this: Expected<T>, func: (value: T) => U): Expected<U> {
    if (this.isError())
      return new ExpectedError<U>(this.error);
    else
      return Expected.fromTry(() => func(this.value));
  }

  /**
   * Maps the successful value of this `Expected` to a new `Expected` using the provided function. If this
   * `Expected` is an error, the same error is returned and the mapping function is not called.
   *
   * This function does not throw exceptions; if the mapping function throws an exception, it will
   * be captured and returned as an error in the resulting `Expected`.
   */
  public flatMap<U>(this: Expected<T>, func: (value: T) => Expected<U>): Expected<U> {
    if (this.isError())
      return new ExpectedError<U>(this.error);
    const expected = Expected.fromTry(() => func(this.value));
    if (expected.isError())
      return Expected.fromError<U>(expected.error);
    return expected.value;
  }
}

class ExpectedValue<T> extends ExpectedBase<T> {
  public constructor(public readonly value: T) { super(); }
}

class ExpectedError<T> extends ExpectedBase<T> {
  public constructor(public readonly error: IModelError) { super(); }
}

/**
 * Represents a value that may either be a successful result (a value of type `T`) or an error (an `IModelError`).
 */
type Expected<T> = ExpectedValue<T> | ExpectedError<T>;

namespace Expected {
  /**
   * Creates a new `Expected` object that represents a successful result with the given value.
   */
  export function fromValue<T>(value: T): Expected<T> {
    return new ExpectedValue<T>(value);
  }

  /**
   * Creates a new `Expected` object that represents an error with the given `IModelError`.
   */
  export function fromError<T>(error: IModelError): Expected<T> {
    return new ExpectedError<T>(error);
  }

  /**
   * Invokes the given function and returns an [[Expected]] that represents either the successful result of the function
   * or any error thrown by the function. No exception thrown by the function will be allowed to escape this function;
   * instead, all exceptions will be captured and returned as an `IModelError` in the resulting `Expected`.
   *
   * If the function throws an exception that is an IModelError, it is provided as-is. If the exception is some
   * other type, a new `IModelError` is created to wrap the original exception, and the original is provided via the
   * new exception's `cause` property. The new `IModelError` will have an `errorNumber` taken from the original
   * exception if it has one (i.e., if the original exception is a [[BentleyError]]), or `IModelStatus.BadRequest`
   * if not. The message will be taken from the original exception's message.
   *
   * This function is useful for implementing methods that should raise exceptions with a consistent type
   * (i.e., `IModelError`) while calling into code that may throw exceptions of various types. It is also useful for
   * implementing "try" functions that should not throw (e.g., that return `undefined` on error) but need to call into code
   * that may throw exceptions.
   */
  export function fromTry<T>(
    func: () => T
  ): Expected<T> {
    try {
      return fromValue(func());
    } catch (err: any) {
      if (err instanceof IModelError)
        return fromError(err);
      const wrappedError = new IModelError(err.errorNumber ?? IModelStatus.BadRequest, err.message);
      wrappedError.cause = err;
      return fromError(wrappedError);
    }
  }
}

export { Expected };