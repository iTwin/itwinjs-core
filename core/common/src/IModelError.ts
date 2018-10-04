/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModels */

import { BentleyStatus, BentleyError, IModelStatus, BriefcaseStatus, GetMetaDataFunction, LogFunction, DbResult, RepositoryStatus, ChangeSetStatus, RpcInterfaceStatus } from "@bentley/bentleyjs-core";
export { BentleyStatus, BentleyError, IModelStatus, BriefcaseStatus, GetMetaDataFunction, LogFunction, DbResult, RepositoryStatus, ChangeSetStatus, RpcInterfaceStatus } from "@bentley/bentleyjs-core";

/** The error type thrown by this module. See [[IModelStatus]] for `errorNumber` values. */
export class IModelError extends BentleyError {
  public constructor(errorNumber: number | IModelStatus | DbResult | BentleyStatus | BriefcaseStatus | RepositoryStatus | ChangeSetStatus | RpcInterfaceStatus, message?: string, log?: LogFunction, category?: string, getMetaData?: GetMetaDataFunction) {
    super(errorNumber, message, log, category, getMetaData);
  }
}

export class ServerError extends IModelError {
  public constructor(errorNumber: number, message?: string, log?: LogFunction) {
    super(errorNumber, message, log);
    this.name = "Server error (" + errorNumber + ")";
  }
}
