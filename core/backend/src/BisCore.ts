/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module BisCore */

import { Schema, Schemas } from "./Schema";
import { ClassRegistry } from "./ClassRegistry";

import * as elementMod from "./Element";
import * as aspectMod from "./ElementAspect";
import * as modelMod from "./Model";
import * as categoryMod from "./Category";
import * as viewMod from "./ViewDefinition";
import * as linkMod from "./LinkTableRelationship";

/** Represents the BisCore schema.
 * <p><em>Example:</em>
 * ``` ts
 * [[include:BisCore.registerSchemaAndGetClass]]
 * ```
 */
export class BisCore extends Schema {

  /** Call this to register the BisCore schema prior to using it. */
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
