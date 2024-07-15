/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import * as path from "path";
import { DbResult } from "@itwin/core-bentley";
import { IModelError } from "@itwin/core-common";
import { ClassRegistry } from "../ClassRegistry";
import { IModelDb } from "../IModelDb";
import { KnownLocations } from "../IModelHost";
import { Schema, Schemas } from "../Schema";
import * as elementsModule from "./FunctionalElements";
import { _nativeDb } from "../internal/Symbols";

/** @public */
export class FunctionalSchema extends Schema {
  public static override get schemaName(): string { return "Functional"; }
  public static get schemaFilePath(): string { return path.join(KnownLocations.nativeAssetsDir, "ECSchemas", "Domain", `${FunctionalSchema.schemaName}.ecschema.xml`); }
  public static registerSchema() {
    if (this !== Schemas.getRegisteredSchema(this.schemaName)) {
      Schemas.unregisterSchema(this.schemaName);
      Schemas.registerSchema(this);
      ClassRegistry.registerModule(elementsModule, this);
    }
  }

  /** @public */
  public static async importSchema(iModelDb: IModelDb) {
    if (iModelDb.isBriefcaseDb())
      await iModelDb.acquireSchemaLock();

    const stat = iModelDb[_nativeDb].importFunctionalSchema();
    if (DbResult.BE_SQLITE_OK !== stat) {
      throw new IModelError(stat, "Error importing Functional schema");
    }
  }
}
