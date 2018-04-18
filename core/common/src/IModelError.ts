/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { BentleyStatus, BentleyError, IModelStatus, BriefcaseStatus, GetMetaDataFunction, LogFunction, DbResult } from "@bentley/bentleyjs-core";
export { BentleyStatus, BentleyError, IModelStatus, BriefcaseStatus, GetMetaDataFunction, LogFunction, DbResult } from "@bentley/bentleyjs-core";

/** @module Errors */

/** The error type thrown by this module. See [[IModelStatus]] for `errorNumber` values. */
export class IModelError extends BentleyError {
  public constructor(errorNumber: number | IModelStatus | DbResult | BentleyStatus | BriefcaseStatus, message?: string, log?: LogFunction, category?: string, getMetaData?: GetMetaDataFunction) {
    super(errorNumber, message, log, category, getMetaData);
  }
}

export class ServerError extends IModelError {
  public constructor(errorNumber: number, message?: string, log?: LogFunction) {
    super(errorNumber, message, log);
    this.name = "Server error (" + errorNumber + ")";
  }
}
