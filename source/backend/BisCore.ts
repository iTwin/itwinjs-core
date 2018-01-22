/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { Schema, Schemas } from "./Schema";
import { ClassRegistry } from "./ClassRegistry";

/** Represents the BisCore schema.
 * ``` ts
 * [[include:BisCore1.sampleCode]]
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
    ClassRegistry.registerModule(require("./Element"), this);
    ClassRegistry.registerModule(require("./ElementAspect"), this);
    ClassRegistry.registerModule(require("./Model"), this);
    ClassRegistry.registerModule(require("./Category"), this);
    ClassRegistry.registerModule(require("./ViewDefinition"), this);
    ClassRegistry.registerModule(require("./LinkTableRelationship"), this);
  }
}
