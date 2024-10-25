import { BentleyError, LoggingMetaData } from "@itwin/core-bentley";
import { LockState } from "./IModelError";

/**
 * Detailed information about a particular object Lock that is causing the Lock update conflict.
 * An example of a lock update conflict would be attempting to use [LockControl.acquireLocks]($backend) on an object that is already locked by another Briefcase.
 * @beta
 */
export interface InUseLock {
  /** Id of the object that is causing conflict. */
  objectId: string;
  /**
   * The level of conflicting lock. Possible values are {@link LockState.Shared}, {@link LockState.Exclusive}.
   * See {@link LockState}.
   */
  state: LockState;
  /** An array of Briefcase ids that hold this lock. */
  briefcaseIds: number[];
}

/**
 * An interface used to describe an error for a developer/application. The message is not intended to be displayed to an end user.
 * This error interface should be extended when needing to throw errors with extra properties defined on them. See [[InUseLocksError]] for an example.
 * When extending ITwinError, one should typically add a type guard function and a function to throw the error to the ITwinError namespace for their specific error.
 * See [[ITwinError.throwInUseLocksError]] and [[ITwinError.isInUseLocksError]] for examples of how to throw and check that an error is of type InUseLocksError.
 * @example
 * ```ts
 * try {
 *  await briefcaseDb.locks.acquireLocks({ exclusive: elementId });
 * } catch (err: unknown) {
 *  if (ITwinError.isInUseLocksError(err)) {
 *    const inUseLocks = err.inUseLocks;
 *    const briefcaseIds = inUseLocks.briefcaseIds;
 *    const state = inUseLocks.state;
 *    const objectId = inUseLocks.objectId;
 *    // Create a user friendly error message
 *  } else {
 *    throw err;
 *  }
 * ```
 * @beta
 */
export interface ITwinError {
  /** namespace for the error. This is a unique qualifier for the errorKey. */
  namespace: string;
  /** unique key for error, within namespace. All errorKeys within the same namespace must be unique. */
  errorKey: string;
  /** explanation of what went wrong. Intended to be read by a developer. */
  message: string;
  /** stack trace of the error. */
  stack?: string;
  /** metadata about the exception. */
  metadata?: LoggingMetaData;
}

/**
 * An error raised when there is a lock conflict detected.
 * Typically this error would be thrown by [LockControl.acquireLocks]($backend) when you are requesting a lock on an element that is already held by another briefcase.
 * @beta
*/
export interface InUseLocksError extends ITwinError {
  namespace: "itwinjs-core";
  errorKey: "in-use-locks";
  inUseLocks: InUseLock[];
}

/**
 * Functions for throwing ITwinErrors and checking that objects are of a specific ITwinError type.
 * @beta
 */
export namespace ITwinError {
  export function isITwinError(error: unknown): error is ITwinError {
    return error !== undefined && error !== null && typeof error === "object" && "namespace" in error && "errorKey" in error && "message" in error;
  }

  export function isInUseLocksError(error: unknown): error is InUseLocksError {
    return isITwinError(error) && error.namespace === "itwinjs-core" && error.errorKey === "in-use-locks";
  }

  /** get the meta data associated with this ITwinError, if any. */
  export function getMetaData(err: ITwinError): object | undefined {
    return BentleyError.getMetaData(err.metadata);
  }

  export function throwInUseLocksError(inUseLocks: InUseLock[], message?: string, metadata?: LoggingMetaData): never {
    const errorObject = new Error();
    errorObject.name = "InUseLocksError"; // optional but makes it so that when the error is thrown and not caught we see InUseLocksError: 'message' instead of Error: 'message'
    Error.captureStackTrace(errorObject, throwInUseLocksError); // optional: whether we want to hide throwInUseLocksError or not from the stack. not super important
    const lockError: InUseLocksError = {
      namespace: "itwinjs-core",
      errorKey: "in-use-locks",
      message: message ?? "One or more objects are already locked by another briefcase.", // TODO: Should we allow for a custom message to be thrown? Might be unnecessary
      metadata,
      inUseLocks,
    };
    Object.assign(errorObject, lockError);
    throw errorObject;
  }
};
