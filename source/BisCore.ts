/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { DgnDomain, DgnDomains } from "./DgnDomain";

import { Category, SubCategory, DrawingCategory, SpatialCategory } from "./Category";
import {
  CategorySelector, ModelSelector, ViewDefinition, ViewDefinition3d, SpatialViewDefinition, OrthographicViewDefinition,
  DisplayStyle, DisplayStyle2d, DisplayStyle3d,
} from "./ViewDefinition";
import { Element, GeometricElement } from "./Element";

import { EcRegistry } from "./EcRegistry";

/** BisCore.ClassName */
export enum BisCore {
  Schema = "BisCore",
  Category = "BisCore.Category",
  CategorySelector = "BisCore.CategorySelector",
  DisplayStyle = "BisCore.DisplayStyle",
  DisplayStyle2d = "BisCore.DisplayStyle2d",
  DisplayStyle3d = "BisCore.DisplayStyle3d",
  DrawingCategory = "BisCore.DrawingCategory",
  Element = "BisCore.Element",
  GeometricElement = "BisCore.GeometricElement",
  ModelSelector = "BisCore.ModelSelector",
  OrthographicViewDefinition = "BisCore.OrthographicViewDefinition",
  RepositoryLink = "BisCore.RepositoryLink",
  SpatialCategory = "BisCore.SpatialCategory",
  SpatialViewDefinition = "BisCore.SpatialViewDefinition",
  SpatialViewDefinitionUsesModelSelector = "BisCore.SpatialViewDefinitionUsesModelSelector",
  SubCategory = "BisCore.SubCategory",
  ViewDefinition = "BisCore.ViewDefinition",
  ViewDefinition3d = "BisCore.ViewDefinition3d",
}

/** Just ClassName, no "BisCore." prefix */
export enum BisClass {
  Category = "Category",
  CategorySelector = "CategorySelector",
  DisplayStyle = "DisplayStyle",
  DisplayStyle2d = "DisplayStyle2d",
  DisplayStyle3d = "DisplayStyle3d",
  DrawingCategory = "DrawingCategory",
  Element = "Element",
  GeometricElement = "GeometricElement",
  ModelSelector = "ModelSelector",
  OrthographicViewDefinition = "OrthographicViewDefinition",
  RepositoryLink = "RepositoryLink",
  SpatialCategory = "SpatialCategory",
  SpatialViewDefinition = "SpatialViewDefinition",
  SpatialViewDefinitionUsesModelSelector = "SpatialViewDefinitionUsesModelSelector",
  SubCategory = "SubCategory",
  ViewDefinition = "ViewDefinition",
  ViewDefinition3d = "ViewDefinition3d",
}

/**
 * Represents the BisCore domain and ECSchema. Registers all classes in the BisCore ECSchema.
 */
export class BisCoreDomain implements DgnDomain {

  public static domainName: string = "BisCore";

  /**
   * Call this to register the BisCore domain prior to using it.
   */
  public static register() {
    if (!DgnDomains.getRegisteredDomain(BisCoreDomain.domainName))
      DgnDomains.registerDomain( new BisCoreDomain());
  }

  public get domainName(): string { return BisCoreDomain.domainName; }

  /**
   * Initialize the BisCore domain prior to using any of its classes.
   */
  private constructor() {
    const customHandledClasses = [
      Category, SubCategory, DrawingCategory, SpatialCategory, CategorySelector, ModelSelector, ViewDefinition, ViewDefinition3d, SpatialViewDefinition, OrthographicViewDefinition,
      DisplayStyle, DisplayStyle2d, DisplayStyle3d, Element, GeometricElement,
    ];
    for (const cls of customHandledClasses) {
      Object.getPrototypeOf(cls).constructor.domain = this;
      EcRegistry.registerEcClass2(BisCoreDomain.domainName, cls);
    }
  }
}
