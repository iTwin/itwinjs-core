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
  public isValue(this: Expected<T>): this is ExpectedValue<T> {
    return this instanceof ExpectedValue;
  }

  public isError(this: Expected<T>): this is ExpectedError<T> {
    return this instanceof ExpectedError;
  }

  public valueOrDefault<U>(this: Expected<T>, defaultValue: U): T | U {
    return this.isValue() ? this.value : defaultValue;
  }

  public valueOrThrow(this: Expected<T>): T {
    if (this.isError())
      throw this.error;
    return this.value;
  }

  public map<U>(this: Expected<T>, func: (value: T) => U): Expected<U> {
    if (this.isError())
      return new ExpectedError<U>(this.error);

    try {
      return new ExpectedValue<U>(func(this.value));
    } catch (err: any) {
      if (err instanceof IModelError)
        return new ExpectedError<U>(err);
      const wrappedError = new IModelError(err.errorNumber ?? IModelStatus.BadRequest, err.message);
      wrappedError.cause = err;
      return new ExpectedError<U>(wrappedError);
    }
  }
}

class ExpectedValue<T> extends ExpectedBase<T> {
  public constructor(public readonly value: T) { super(); }
}

class ExpectedError<T> extends ExpectedBase<T> {
  public constructor(public readonly error: IModelError) { super(); }
}

type Expected<T> = ExpectedValue<T> | ExpectedError<T>;

namespace Expected {
  export function fromValue<T>(value: T): Expected<T> {
    return new ExpectedValue<T>(value);
  }

  export function fromError<T>(error: IModelError): Expected<T> {
    return new ExpectedError<T>(error);
  }

  /**
   * Invokes the given function.
   *
   * If the function succeeds (does not throw an exception), this function returns the value returned by
   * the function in the `value` property of the returned object.
   *
   * If the function throws an exception, that exception will not be allowed to escape this function. Instead, this
   * function returns an object with the `error` property set to an `IModelError` that represents the thrown
   * exception. If the original exception is an IModelError, it is provided as-is. If the original exception is some
   * other type, a new `IModelError` is created to wrap the original exception, and the original is provided via the
   * new exception's `cause` property. The new `IModelError` will have an `errorNumber` taken from the original
   * exception if it has one (i.e., if the original exception is a [[BentleyError]]), or the provided default
   * `errorNumber` if not. The message will be taken from the original exception's message.
   *
   * This function is useful for implementing methods that should raise exceptions with a consistent type
   * (i.e., `IModelError`) while calling into code that may throw exceptions of various types. It is also useful for
   * implementing functions that should not throw (e.g., that return `undefined` on error) but need to call into code
   * that may throw exceptions.
   *
   * @param func
   * @returns
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