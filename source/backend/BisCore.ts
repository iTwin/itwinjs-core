/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { Schema, Schemas } from "./Schema";
import { ClassRegistry } from "./ClassRegistry";

declare var require: any;

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
    ClassRegistry.registerModuleClasses(require("./Element"), this);
    ClassRegistry.registerModuleClasses(require("./ElementAspect"), this);
    ClassRegistry.registerModuleClasses(require("./Model"), this);
    ClassRegistry.registerModuleClasses(require("./Category"), this);
    ClassRegistry.registerModuleClasses(require("./ViewDefinition"), this);
    ClassRegistry.registerModuleClasses(require("./LinkTableRelationship"), this);
  }
}
