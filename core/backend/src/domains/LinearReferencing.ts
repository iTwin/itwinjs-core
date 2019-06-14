/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Schema */

import { AuthStatus, ClientRequestContext } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext } from "@bentley/imodeljs-clients";
import { IModelError } from "@bentley/imodeljs-common";
import { IModelDb } from "../IModelDb";
import { ClassRegistry } from "../ClassRegistry";
import { Schema, Schemas } from "../Schema";
import { KnownLocations } from "../IModelHost";
import * as path from "path";
import * as elementsModule from "./LinearReferencingElements";

/** Schema class for the LinearReferencing domain.
 * @beta
 */
export class LinearReferencingSchema extends Schema {
  public static get schemaName(): string { return "LinearReferencing"; }
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

    await iModelDb.importSchema(requestContext, path.join(KnownLocations.nativeAssetsDir, "ECSchemas\\Domain\\LinearReferencing.ecschema.xml"));
  }
}
