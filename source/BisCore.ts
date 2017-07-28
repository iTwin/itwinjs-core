/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { Schema, Schemas } from "./Schema";
import * as category from "./Category";
import * as element from "./Element";
import * as viewDef from "./ViewDefinition";
import { ClassRegistry } from "./ClassRegistry";

/** Represents the BisCore schema and ECSchema. Registers all classes in the BisCore ECSchema. */
export class BisCore extends Schema {

  /** Call this to register the BisCore schema prior to using it.  */
  public static registerSchema() {
    if (!Schemas.getRegisteredSchema(BisCore.name))
      Schemas.registerSchema(new BisCore());
  }

  /**
   * Initialize the BisCore schema prior to using any of its classes.
   */
  private constructor() {
    super();
    ClassRegistry.registerModuleClasses(category, this);
    ClassRegistry.registerModuleClasses(element, this);
    ClassRegistry.registerModuleClasses(viewDef, this);
  }
}
