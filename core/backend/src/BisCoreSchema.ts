/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import * as path from "path";
import * as categoryMod from "./Category.js";
import { ClassRegistry } from "./ClassRegistry.js";
import * as displayStyleMod from "./DisplayStyle.js";
import * as elementMod from "./Element.js";
import * as aspectMod from "./ElementAspect.js";
import * as externalSourceMod from "./ExternalSource.js";
import { KnownLocations } from "./IModelHost.js";
import * as materialMod from "./Material.js";
import * as modelMod from "./Model.js";
import * as linkMod from "./Relationship.js";
import { Schema, Schemas } from "./Schema.js";
import * as sheetIndex from "./SheetIndex.js";
import * as annotationsMod from "./TextAnnotationElement.js";
import * as textureMod from "./Texture.js";
import * as viewMod from "./ViewDefinition.js";

/**
 * The [BisCore]($docs/bis/guide/fundamentals/schemas-domains.md) schema is the lowest level Schema in an iModel.
 *
 * It is automatically registered when [[IModelHost.startup]] is called.
 *
 * Example:
 * ``` ts
 * [[include:BisCore.registerSchemaAndGetClass]]
 * ```
 * @public
 */
export class BisCoreSchema extends Schema {
  public static override get schemaName(): string { return "BisCore"; }
  public static get schemaFilePath(): string { return path.join(KnownLocations.nativeAssetsDir, "ECSchemas", "Dgn", `${BisCoreSchema.schemaName}.ecschema.xml`); }

  /** @internal */
  public static registerSchema() {
    if (this === Schemas.getRegisteredSchema(this.schemaName))
      return;

    Schemas.unregisterSchema(this.schemaName);
    Schemas.registerSchema(this);

    // this list should include all backend .ts files with implementations of Entity-based classes. Order does not matter.
    [
      elementMod,
      aspectMod,
      modelMod,
      categoryMod,
      viewMod,
      linkMod,
      textureMod,
      materialMod,
      externalSourceMod,
      displayStyleMod,
      annotationsMod,
      sheetIndex
    ].forEach((module) => ClassRegistry.registerModule(module, this));
  }
}
