/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { BentleyError, IModelStatus, BriefcaseStatus, GetMetaDataFunction } from "@bentley/bentleyjs-core/lib/BentleyError";
import { DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { BentleyStatus } from "@bentley/bentleyjs-core/lib/Bentley";
import { LogFunction } from "@bentley/bentleyjs-core/lib/Logger";

/** The error type thrown by this module. See [[IModelStatus]] for `errorNumber` values. */
export class IModelError extends BentleyError {
  public constructor(errorNumber: number | IModelStatus | DbResult | BentleyStatus | BriefcaseStatus, message?: string, log?: LogFunction, getMetaData?: GetMetaDataFunction) {
    super(errorNumber, message, log, getMetaData);
  }
}
