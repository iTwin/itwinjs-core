/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
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
import * as linkMod from "./LinkTableRelationship";

/**
 * The [BisCore]($docs/bis/intro/schemas-domains.md) schema is the lowest level Schema in an iModel.
 *
 * It is automatically registered when [[IModelHost.startup]] is called.
 *
 * ** Example:**
 * ``` ts
 * [[include:BisCore.registerSchemaAndGetClass]]
 * ```
 */
export class BisCore extends Schema {
  /**
   * Call this method to register the BisCore schema prior to using it.
   * @note This method is called automatically by [[IModelHost.startup]], so it is rarely necessary to call it directly
   */
  public static registerSchema() {
    if (!Schemas.getRegisteredSchema(BisCore.name))
      Schemas.registerSchema(new BisCore());
  }

  // Registers all classes of the BisCore schema.
  private constructor() {
    super();
    // this list should include all backend .ts files with implementations of Entity-based classes. Order does not matter.
    ClassRegistry.registerModule(elementMod, this);
    ClassRegistry.registerModule(aspectMod, this);
    ClassRegistry.registerModule(modelMod, this);
    ClassRegistry.registerModule(categoryMod, this);
    ClassRegistry.registerModule(viewMod, this);
    ClassRegistry.registerModule(linkMod, this);
  }
}
