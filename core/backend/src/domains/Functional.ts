/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Schema */

import { AuthStatus, ClientRequestContext, DbResult, Logger } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext } from "@bentley/imodeljs-clients";
import { IModelError } from "@bentley/imodeljs-common";
import { ClassRegistry } from "../ClassRegistry";
import { IModelDb } from "../IModelDb";
import { BackendLoggerCategory } from "../BackendLoggerCategory";
import { Schema, Schemas } from "../Schema";
import * as elementsModule from "./FunctionalElements";

const loggerCategory: string = BackendLoggerCategory.Functional;

/** @public */
export class FunctionalSchema extends Schema {
  public static get schemaName(): string { return "Functional"; }
  public static registerSchema() {
    if (this !== Schemas.getRegisteredSchema(this.schemaName)) {
      Schemas.unregisterSchema(this.schemaName);
      Schemas.registerSchema(this);
      ClassRegistry.registerModule(elementsModule, this);
    }
  }

  public static async importSchema(requestContext: AuthorizedClientRequestContext | ClientRequestContext, iModelDb: IModelDb) {
    // NOTE: this concurrencyControl logic was copied from IModelDb.importSchema
    requestContext.enter();
    if (!iModelDb.isStandalone) {
      if (!(requestContext instanceof AuthorizedClientRequestContext))
        throw new IModelError(AuthStatus.Error, "Importing the schema requires an AuthorizedClientRequestContext");
      await iModelDb.concurrencyControl.lockSchema(requestContext);
      requestContext.enter();
    }
    const stat = iModelDb.briefcase.nativeDb.importFunctionalSchema();
    if (DbResult.BE_SQLITE_OK !== stat) {
      throw new IModelError(stat, "Error importing Functional schema", Logger.logError, loggerCategory);
    }
    // FunctionalDomain (C++) does not create Category or other Elements on import
  }
}
