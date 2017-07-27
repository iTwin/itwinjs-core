/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { Schema, Schemas } from "./Schema";

import { Category, SubCategory, DrawingCategory, SpatialCategory } from "./Category";
import {
  CategorySelector, ModelSelector, ViewDefinition, ViewDefinition3d, SpatialViewDefinition, OrthographicViewDefinition,
  DisplayStyle, DisplayStyle2d, DisplayStyle3d,
} from "./ViewDefinition";
import { Element, GeometricElement } from "./Element";

import { EcRegistry } from "./EcRegistry";

/**
 * Represents the BisCore schema and ECSchema. Registers all classes in the BisCore ECSchema.
 */
export class BisCore extends Schema {

  /**
   * Call this to register the BisCore schema prior to using it.
   */
  public static registerSchema() {
    if (!Schemas.getRegisteredSchema(BisCore.name))
      Schemas.registerSchema(new BisCore());
  }

  /**
   * Initialize the BisCore schema prior to using any of its classes.
   */
  private constructor() {
    super();
    const customHandledClasses = [
      Category, SubCategory, DrawingCategory, SpatialCategory, CategorySelector, ModelSelector, ViewDefinition, ViewDefinition3d, SpatialViewDefinition, OrthographicViewDefinition,
      DisplayStyle, DisplayStyle2d, DisplayStyle3d, Element, GeometricElement,
    ];
    for (const cls of customHandledClasses) {
      cls.schema = this;
      EcRegistry.registerEcClass(cls);
    }
  }
}
