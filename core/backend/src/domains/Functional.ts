/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module Schema */

import { DbResult, Logger } from "@bentley/bentleyjs-core";
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
  // WIP: async
  public static importSchema(iModelDb: IModelDb) {
    const stat = iModelDb.briefcase.nativeDb.importFunctionalSchema();
    if (DbResult.BE_SQLITE_OK !== stat) {
      throw new IModelError(stat, "Error importing Functional schema", Logger.logError, loggingCategory);
    }
  }
}
