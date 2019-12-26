/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Schema */

import * as path from "path";
import { ClassRegistry } from "../ClassRegistry";
import { KnownLocations } from "../IModelHost";
import { Schema, Schemas } from "../Schema";

import * as elementsModule from "./GenericElements";

/** @public */
export class GenericSchema extends Schema {
  public static get schemaName(): string { return "Generic"; }
  public static get schemaFilePath(): string { return path.join(KnownLocations.nativeAssetsDir, "ECSchemas", "Dgn", `${GenericSchema.schemaName}.ecschema.xml`); }
  public static registerSchema() {
    if (this !== Schemas.getRegisteredSchema(this.schemaName)) {
      Schemas.unregisterSchema(this.schemaName);
      Schemas.registerSchema(this);
      ClassRegistry.registerModule(elementsModule, this);
    }
  }
}
