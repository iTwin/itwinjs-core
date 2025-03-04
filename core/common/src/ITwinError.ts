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
 * error namespaces object to describe namespaces for a developer/application.
 * @beta
 */
/* eslint-disable @typescript-eslint/naming-convention */
export const ITwinErrorNamespaces = {
  ITwinJsCore: "itwinjs-core"
} as const;

/**
 * error keys object used to describe an error keys for a developer/application.
 * @beta
 */
/* eslint-disable @typescript-eslint/naming-convention */
export const ITwinErrorKeys = {
  InUseLocks: "in-use-locks",
  ChannelNest: "channel-may-not-nest",
  ChannelNotAllowed: "channel-not-allowed",
  ChannelRootExists: "channel-root-exists"
} as const;

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
* A function which will be used to construct an error.
* @param namespace The namespace associated with the error.
* @param errorKey The errorKey associated with the error.
* @param message The message associated with the error.
* @param metadata Metadata associated with the error.
* @beta
*/
export function constructError(namespace: string, errorKey: string, message?: string, metadata?: LoggingMetaData): ITwinError {

  const error: ITwinError = {
    name: `${namespace}:${errorKey}`,
    namespace,
    errorKey,
    message: message ?? `${errorKey} occurred`,
    metadata,
  };

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
  const baseError = constructError(namespace, errorKey, message, metadata);

  return Object.assign(baseError, details) as T;
}

/**
 * a high level function that returns a type asserter function which would return whether or not the passed in parameter is an [[ITwinError]]
 * @param namespace The namespace associated with the error.
 * @param errorKey The errorKey associated with the error.
 * @beta
*/
export function createTypeAsserter<T extends ITwinError>(namespace: string, errorKey: string) {
  return (error: unknown): error is T => isITwinError(error, namespace, errorKey);
}

/**
 * get the meta data associated with this ITwinError, if any.
 * @param error The error for which metadata is required.
 * @beta
*/
export function getMetaData(error: ITwinError): object | undefined {
  return BentleyError.getMetaData(error.metadata);
}

/**
 * type guard function that returns whether or not the passed in parameter is an [[ITwinError]]
 * @param error The error which is to ve verified.
 * @param namespace The namespace associated with the error.
 * @param errorKey The errorKey associated with the error.
 * @beta
*/
export function isITwinError(error: unknown, namespace?: string, errorKey?: string): error is ITwinError {
  return error !== undefined && error !== null && typeof error === "object" && "namespace" in error && "errorKey" in error && "message" in error && (namespace === undefined || (error as ITwinError).namespace === namespace) && (errorKey === undefined || (error as ITwinError).errorKey === errorKey);
}
