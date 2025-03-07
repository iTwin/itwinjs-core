/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { LoggingMetaData } from "@itwin/core-bentley";
import { LockState } from "./IModelError";
import { BriefcaseId } from "./BriefcaseTypes";

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
  briefcaseIds: BriefcaseId[];
}

/**
 * iTwinjs Core namespace namespace for a developer/application.
 * @beta
 */
export const iTwinjsCoreNamespace = "itwinjs-core";

/**
 * error keys object used to describe an error keys for a developer/application.
 * @beta
 */
export const iTwinErrorKeys = {
  inUseLocks: "in-use-locks",
  channelNest: "channel-may-not-nest",
  channelNotAllowed: "channel-not-allowed",
  channelRootExists: "channel-root-exists"
} as const;

/**
 * error type of iTwinErrorKeys.
 */
type ErrorType = keyof typeof iTwinErrorKeys;

/**
 * function that accepts multiple arguments and returns corresponding message.
 */
type ErrorMessageFn = (...args: any[]) => string;

/**
 * Record for all itwin error messages.
 * @beta
 */
export const iTwinErrorMessages: Record<ErrorType, ErrorMessageFn> = {
  "inUseLocks": () => 'Objects are locked by another briefcase',
  "channelNest": (id) => `Channel ${id} may not nest`,
  "channelNotAllowed": (id) => `Channel ${id} is not allowed`,
  "channelRootExists": (id) => `Channel ${id} root already exist`,
};


/**
 * An interface used to describe an error for a developer/application. The message is not intended to be displayed to an end user.
 * This error interface should be extended when needing to throw errors with extra properties defined on them. See [[InUseLocksError]] for an example.
 * @beta
 */
export interface ITwinError extends Error {
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

/**
* A function which will be used to construct an [[ITwinError]].
* @param namespace The namespace associated with the error.
* @param errorKey The errorKey associated with the error.
* @param message The message associated with the error.
* @param metadata Metadata associated with the error.
* @beta
*/
export function constructITwinError(namespace: string, errorKey: string, message?: string, metadata?: LoggingMetaData): ITwinError {

  const error = new Error() as ITwinError;
  error.message = message ?? `${errorKey} occurred`;
  error.name = `${namespace}:${errorKey}`;
  error.namespace = namespace;
  error.errorKey = errorKey;
  error.metadata = metadata;

  Error.captureStackTrace(error, constructITwinError); // Optional, but this would hide constructITwinError from stack.
  return error;
}

/**
* A function which constructs a detailed error for example [[ InUseLocksError ]] above.
* @param namespace The namespace associated with the error.
* @param errorKey The errorKey associated with the error.
* @param details Other details associated with the error.
* @param message The message associated with the error.
* @param metadata Metadata associated with the error.
* @beta
*/
export function constructDetailedError<T extends ITwinError>(namespace: string, errorKey: string, details: Omit<T, keyof ITwinError>, message?: string, metadata?: LoggingMetaData): T {
  const baseError = constructITwinError(namespace, errorKey, message, metadata);

  Error.captureStackTrace(baseError, constructDetailedError); // Optional, but this would hide constructDetailedError from stack.
  return Object.assign(baseError, details) as T;
}

/**
 * a high level function that returns a type asserter function which would return whether or not the passed in parameter is an [[ITwinError]]
 * @param namespace The namespace associated with the error.
 * @param errorKey The errorKey associated with the error.
 * @beta
*/
export function createITwinErrorTypeAsserter<T extends ITwinError>(namespace: string, errorKey: string) {
  return (error: unknown): error is T => isITwinError(error, namespace, errorKey);
}

/**
 * get the meta data associated with this ITwinError, if any.
 * @param error The error for which metadata is required.
 * @beta
*/
export function getITwinErrorMetaData(error: ITwinError): object | undefined {
  return (typeof error.metadata === "function") ? error.metadata() : error.metadata;
}

/**
 * type guard function that returns whether or not the passed in parameter is an [[ITwinError]]
 * @param error The error which is to ve verified.
 * @param namespace The namespace associated with the error.
 * @param errorKey The errorKey associated with the error.
 * @beta
*/
export function isITwinError(error: unknown, namespace?: string, errorKey?: string): error is ITwinError {
  return error !== undefined && error !== null && typeof error === "object"
    && "namespace" in error && "errorKey" in error && "message" in error
    && (namespace === undefined || (error as ITwinError).namespace === namespace)
    && (errorKey === undefined || (error as ITwinError).errorKey === errorKey);
}
