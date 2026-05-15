/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Analytical
 */

import * as path from "node:path";
import { ClassRegistry, KnownLocations, Schema, Schemas } from "@itwin/core-backend";
import * as elementsModule from "./AnalyticalElements";
import * as modelsModule from "./AnalyticalModels";
import * as relationshipsModule from "./AnalyticalRelationships";

/** Schema class for the Analytical domain.
 * @beta
 */
export class AnalyticalSchema extends Schema {
  public static override get schemaName(): string { return "Analytical"; }
  /**
   * TODO: Currently the schema file comes from a hardcoded path assuming its delivered with imodeljs-native
   * Look to add a dependency on @bentley/analytical-schema and using require.resolve to obtain the path
   */
  public static get schemaFilePath(): string { return path.join(KnownLocations.nativeAssetsDir, "ECSchemas", "Domain", "Analytical.ecschema.xml"); }
  public static registerSchema() {
    if (this !== Schemas.getRegisteredSchema(this.schemaName)) {
      Schemas.unregisterSchema(this.schemaName);
      Schemas.registerSchema(this);

      ClassRegistry.registerModule(elementsModule, this);
      ClassRegistry.registerModule(modelsModule, this);
      ClassRegistry.registerModule(relationshipsModule, this);
    }
  }
}
