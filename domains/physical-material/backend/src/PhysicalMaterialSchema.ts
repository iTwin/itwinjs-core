/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PhysicalMaterial
 */

import * as path from "node:path";
import { ClassRegistry, KnownLocations, Schema, Schemas } from "@itwin/core-backend";
import * as elementsModule from "./PhysicalMaterialElements.js";

/** The PhysicalMaterialSchema contains standard physical material classes.
 * A physical material defines the matter that makes up physical elements.
 * @see [PhysicalMaterial]($backend)
 * @public
 */
export class PhysicalMaterialSchema extends Schema {
  public static override get schemaName(): string { return "PhysicalMaterial"; }
  /**
   * TODO: Currently the schema file comes from a hardcoded path assuming its delivered with imodeljs-native
   * Look to add a dependency on @bentley/physicalmaterial-schema and using require.resolve to obtain the path
   */
  public static get schemaFilePath(): string { return path.join(KnownLocations.nativeAssetsDir, "ECSchemas", "Domain", `${PhysicalMaterialSchema.schemaName}.ecschema.xml`); }

  public static registerSchema() {
    if (this !== Schemas.getRegisteredSchema(this.schemaName)) {
      Schemas.unregisterSchema(this.schemaName);
      Schemas.registerSchema(this);
      ClassRegistry.registerModule(elementsModule, this);
    }
  }
}
