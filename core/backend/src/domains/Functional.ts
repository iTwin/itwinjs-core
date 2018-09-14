/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module Schema */

import { ActivityLoggingContext, DbResult, Logger } from "@bentley/bentleyjs-core";
import { IModelError } from "@bentley/imodeljs-common";
import { ClassRegistry } from "../ClassRegistry";
import { IModelDb } from "../IModelDb";
import { Schema, Schemas } from "../Schema";
import * as elementsModule from "./FunctionalElements";

/** @hidden */
const loggingCategory = "imodeljs-backend.Functional";

export class Functional extends Schema {
  public static registerSchema() {
    if (!Schemas.getRegisteredSchema(Functional.name))
      Schemas.registerSchema(new Functional());
  }
  private constructor() {
    super();
    ClassRegistry.registerModule(elementsModule, this);
  }
  public static async importSchema(activityLoggingContext: ActivityLoggingContext, iModelDb: IModelDb) {
    // NOTE: this concurrencyControl logic was copied from IModelDb.importSchema
    activityLoggingContext.enter();
    if (!iModelDb.briefcase.isStandalone) {
      await iModelDb.concurrencyControl.lockSchema(activityLoggingContext, IModelDb.getAccessToken(iModelDb.iModelToken.iModelId!));
      activityLoggingContext.enter();
    }
    const stat = iModelDb.briefcase.nativeDb.importFunctionalSchema();
    if (DbResult.BE_SQLITE_OK !== stat) {
      throw new IModelError(stat, "Error importing Functional schema", Logger.logError, loggingCategory);
    }
    // FunctionalDomain (C++) does not create Category or other Elements on import
  }
}
