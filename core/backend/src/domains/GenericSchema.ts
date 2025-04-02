/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import * as path from "path";
import { ClassRegistry } from "../ClassRegistry.js";
import { KnownLocations } from "../IModelHost.js";
import { Schema, Schemas } from "../Schema.js";
import * as elementsModule from "./GenericElements.js";

/** @public */
export class GenericSchema extends Schema {
  public static override get schemaName(): string { return "Generic"; }
  public static get schemaFilePath(): string { return path.join(KnownLocations.nativeAssetsDir, "ECSchemas", "Dgn", `${GenericSchema.schemaName}.ecschema.xml`); }
  public static registerSchema() {
    if (this !== Schemas.getRegisteredSchema(this.schemaName)) {
      Schemas.unregisterSchema(this.schemaName);
      Schemas.registerSchema(this);
      ClassRegistry.registerModule(elementsModule, this);
    }
  }
}
