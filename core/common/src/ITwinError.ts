/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

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
 * An enum used to describe namespaces for a developer/application.
 * @beta
 */
export enum ITwinErrorNamespaces {
  ItwinJsCore = "itwinjs-core"
}

/**
 * An enum used to describe an error keys for a developer/application.
 * @beta
 */
export enum ITwinErrorKeys {
  InUseLocks = "in-use-locks",
  Channel = "channel-error",
}

/**
 * An interface used to describe an error for a developer/application. The message is not intended to be displayed to an end user.
 * This error interface should be extended when needing to throw errors with extra properties defined on them. See [[InUseLocksError]] for an example.
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
  inUseLocks: InUseLock[];
}

type ITwinAssertFn<T extends ITwinError> = (error: unknown) => error is T;

/** @beta */
export namespace ITwinError {

  /**
 * A function which will be used to construct an error.
 * @param namespace The namespace associated with the error.
 * @param errorKey The errorKey associated with the error.
 * @param message The message associated with the error.
 * @param metadata Metadata associated with the error.
 * @beta
 */
  export function constructError(namespace: string, errorKey: string, message?: string, metadata?: LoggingMetaData): ITwinError {
    const errorObject = new Error();
    errorObject.name = `${namespace}:${errorKey}`;

    const error: ITwinError = {
      namespace,
      errorKey,
      message: message ?? `${errorKey} occurred`,
      metadata
    };

    return Object.assign(errorObject, error);
  }

   /**
 * A function which will be used to construct a details error for example [[ InUseLocksError ]] above.
 * @param namespace The namespace associated with the error.
 * @param errorKey The errorKey associated with the error.
 * @param details Other details associated with the error.
 * @param message The message associated with the error.
 * @param metadata Metadata associated with the error.
 * @beta
 */
  export function constructDetailedError<T extends ITwinError>(namespace: string, errorKey: string, details: Omit<T, keyof ITwinError>, message?: string, metadata?: LoggingMetaData): T {
    const baseError = constructError(namespace, errorKey, message, metadata);

    return Object.assign(baseError, details) as T;
  }

  /** type guard function that returns whether or not the passed in parameter is an extension of [[ITwinError]] */
  export function isValidError<T extends ITwinError>(namespace: string, errorKey: string): ITwinAssertFn<T> {
    return (error: unknown): error is T => {
      return error !== undefined && error !== null && typeof error === "object" && "namespace" in error && "errorKey" in error && (error as ITwinError).namespace === namespace && (error as ITwinError).errorKey === errorKey;
    }
  }

  /** get the meta data associated with this ITwinErrorTest, if any. */
  export function getMetaData(err: ITwinError): object | undefined {
    return BentleyError.getMetaData(err.metadata);
  }

  /** type guard function that returns whether or not the passed in parameter is an [[ITwinError]]
   * Keeping this for now to avoid changes throughout code.
  */
  export function isITwinError(error: unknown): error is ITwinError {
    return error !== undefined && error !== null && typeof error === "object" && "namespace" in error && "errorKey" in error && "message" in error;
  }

};
