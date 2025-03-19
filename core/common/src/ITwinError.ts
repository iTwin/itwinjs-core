/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { LoggingMetaData } from "@itwin/core-bentley";

/**
 * An interface used to describe an exception.
 * This error interface should be extended to throw errors with extra properties defined on them.
 * @beta
 */
export interface ITwinError {
  /** a "namespace" the error. This is a qualifier for the errorKey that should be specific enough to be unique across all ITwinErrors (e.g. the package name followed by error type). */
  scope: string;
  /** unique key for error, within scope. */
  errorKey: string;
  /** explanation of what went wrong. Intended to be read by a developer (i.e. it is *not* localized). */
  message: string;
  /** stack trace of the error. */
  stack?: string;
  /** metadata about the exception. */
  metadata?: LoggingMetaData;
}

export function throwITwinError<T extends ITwinError>(args: T): never {
  throw Object.assign(Error(args.message), args);
}

/**
 * get the meta data associated with an ITwinError, if any.
 * @beta
*/
export function getITwinErrorMetaData(error: ITwinError): object | undefined {
  return (typeof error.metadata === "function") ? error.metadata() : error.metadata;
}

/**
 * type guard function to ensure an error has a specific scope and errorKey
 * @param error The error to ve verified.
 * @param scope value for `error.scope`
 * @param errorKey  value for `error.errorKey`
 * @beta
*/
export function isITwinError<T extends ITwinError>(error: any, scope: string, errorKey: string): error is T {
  return typeof error === "object" && error.scope === scope && error.errorKey === errorKey;
}
