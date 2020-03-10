/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import * as path from "path";
import { ClassRegistry } from "../ClassRegistry";
import { KnownLocations } from "../IModelHost";
import { Schema, Schemas } from "../Schema";
import * as elementsModule from "./LinearReferencingElements";
import * as aspectsModule from "./LinearReferencingElementAspects";
import * as relationshipsModule from "./LinearReferencingRelationships";

/** Schema class for the LinearReferencing domain.
 * @beta
 */
export class LinearReferencingSchema extends Schema {
  public static get schemaName(): string { return "LinearReferencing"; }
  public static get schemaFilePath(): string { return path.join(KnownLocations.nativeAssetsDir, "ECSchemas/Domain/LinearReferencing.ecschema.xml"); }
  public static registerSchema() {
    if (this !== Schemas.getRegisteredSchema(this.schemaName)) {
      Schemas.unregisterSchema(this.schemaName);
      Schemas.registerSchema(this);

      ClassRegistry.registerModule(elementsModule, this);
      ClassRegistry.registerModule(aspectsModule, this);
      ClassRegistry.registerModule(relationshipsModule, this);
    }
  }
}
