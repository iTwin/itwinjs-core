/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Schema */

import { Schema, Schemas } from "./Schema";
import { ClassRegistry } from "./ClassRegistry";

import * as elementMod from "./Element";
import * as aspectMod from "./ElementAspect";
import * as modelMod from "./Model";
import * as categoryMod from "./Category";
import * as viewMod from "./ViewDefinition";
import * as linkMod from "./Relationship";
import * as textureMod from "./Texture";
import * as materialMod from "./Material";

/**
 * The [BisCore]($docs/bis/intro/schemas-domains.md) schema is the lowest level Schema in an iModel.
 *
 * It is automatically registered when [[IModelHost.startup]] is called.
 *
 * ** Example:**
 * ``` ts
 * [[include:BisCore.registerSchemaAndGetClass]]
 * ```
 * @public
 */
export class BisCoreSchema extends Schema {
  public static get schemaName(): string { return "BisCore"; }

  /** @internal */
  public static registerSchema() {
    if (this === Schemas.getRegisteredSchema(this.schemaName))
      return;

    Schemas.unregisterSchema(this.schemaName);
    Schemas.registerSchema(this);
    // this list should include all backend .ts files with implementations of Entity-based classes. Order does not matter.
    ClassRegistry.registerModule(elementMod, this);
    ClassRegistry.registerModule(aspectMod, this);
    ClassRegistry.registerModule(modelMod, this);
    ClassRegistry.registerModule(categoryMod, this);
    ClassRegistry.registerModule(viewMod, this);
    ClassRegistry.registerModule(linkMod, this);
    ClassRegistry.registerModule(textureMod, this);
    ClassRegistry.registerModule(materialMod, this);
  }
}
