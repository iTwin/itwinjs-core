/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import {
  BentleyError, BentleyStatus, BriefcaseStatus, ChangeSetStatus, DbResult, GetMetaDataFunction, IModelStatus, RepositoryStatus,
  RpcInterfaceStatus,
} from "@itwin/core-bentley";

export { BentleyStatus, BentleyError, IModelStatus, BriefcaseStatus, GetMetaDataFunction, LogFunction, DbResult, RepositoryStatus, ChangeSetStatus, RpcInterfaceStatus } from "@itwin/core-bentley";

/** The error type thrown by this module. See [[IModelStatus]] for `errorNumber` values.
 * @public
 */
export class IModelError extends BentleyError {
  public constructor(errorNumber: number | IModelStatus | DbResult | BentleyStatus | BriefcaseStatus | RepositoryStatus | ChangeSetStatus | RpcInterfaceStatus, message: string, getMetaData?: GetMetaDataFunction) {
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
  public constructor(errorNumber: number, name: string, message: string, getMetaData?: GetMetaDataFunction) {
    super(errorNumber, message, getMetaData);
    this.name = name;
  }
}

/**
 * Channel constraint error
 * @alpha
 */
export class ChannelConstraintError extends IModelError {
  public constructor(message: string, getMetaData?: GetMetaDataFunction) {
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
