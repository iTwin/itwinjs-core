/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import {
  BentleyError, BentleyStatus, BriefcaseStatus, ChangeSetStatus, DbResult, IModelStatus, LoggingMetaData, RepositoryStatus,
} from "@itwin/core-bentley";

export {
  BentleyStatus, BentleyError, IModelStatus, BriefcaseStatus, DbResult, ChangeSetStatus,
} from "@itwin/core-bentley";

export type {GetMetaDataFunction, LogFunction, LoggingMetaData} from "@itwin/core-bentley";

/** Numeric values for common errors produced by iTwin.js APIs, typically provided by [[IModelError]].
 * The values within each of these `enum`s are guaranteed not to conflict with one another.
 * @public
 */
export type IModelErrorNumber = IModelStatus | DbResult | BentleyStatus | BriefcaseStatus | ChangeSetStatus;

/** The error type thrown by this module.
 * @see [[IModelErrorNumber]] for commonly-used error codes.
 * @public
 */
export class IModelError extends BentleyError {
  public constructor(errorNumber: IModelErrorNumber | number, message: string, getMetaData?: LoggingMetaData) {
    super(errorNumber, message, getMetaData);
  }
}

/** @public */
export class ServerError extends IModelError {
  public constructor(errorNumber: number, message: string) {
    super(errorNumber, message);
    this.name = `Server error (${errorNumber})`;
  }
}

/** @public */
export class ServerTimeoutError extends ServerError {
  public constructor(message: string) {
    super(IModelStatus.ServerTimeout, message);
    this.name = "Server timeout error";
  }
}

/** @public */
export class BackendError extends IModelError {
  public constructor(errorNumber: number, name: string, message: string, getMetaData?: LoggingMetaData) {
    super(errorNumber, message, getMetaData);
    this.name = name;
  }
}

/**
 * Channel constraint error
 * @alpha
 */
export class ChannelConstraintError extends IModelError {
  public constructor(message: string, getMetaData?: LoggingMetaData) {
    super(RepositoryStatus.ChannelConstraintViolation, message, getMetaData);
  }
}

/** Intended for API "no content" semantics where the error case should not trigger application failure monitoring systems.
 * @public
 */
export class NoContentError extends IModelError {
  public constructor() {
    super(IModelStatus.NoContent, "No Content");
  }
}
