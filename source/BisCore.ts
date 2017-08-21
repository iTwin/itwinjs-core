/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { Schema, Schemas } from "./Schema";
import { ClassRegistry } from "./ClassRegistry";

declare function require(str: string): any;

/** Represents the BisCore schema. */
export class BisCore extends Schema {

  /** Call this to register the BisCore schema prior to using it. */
  public static registerSchema() {
    if (!Schemas.getRegisteredSchema(BisCore.name))
      Schemas.registerSchema(new BisCore());
  }

  // Registers all classes of the BisCore schema.
  private constructor() {
    super();
    // this list should include all .ts files with implementations of Entity-based classes. Order does not matter.
    ClassRegistry.registerModuleClasses(require("./Element"), this);
    ClassRegistry.registerModuleClasses(require("./ElementAspect"), this);
    ClassRegistry.registerModuleClasses(require("./Model"), this);
    ClassRegistry.registerModuleClasses(require("./Category"), this);
    ClassRegistry.registerModuleClasses(require("./ViewDefinition"), this);
  }
}
