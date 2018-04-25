/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module BisCore */

import { Id64, JsonUtils } from "@bentley/bentleyjs-core";
import { BisCodeSpec, Code, ElementProps, Appearance, Rank, AppearanceProps } from "@bentley/imodeljs-common";
import { DefinitionElement } from "./Element";
import { IModelDb } from "./IModelDb";
import { DefinitionModel } from "./Model";

/** Parameters to create a SubCategory element */
export interface SubCategoryProps extends ElementProps {
  appearance?: AppearanceProps;
  description?: string;
}

/** a SubCategory defines the appearance for graphics in Geometric elements */
export class SubCategory extends DefinitionElement {
  public appearance: Appearance;
  public description?: string;

  /** Construct a SubCategory.
   * @param props The properties of the SubCategory
   * @param iModel The IModelDb where the SubCategory may be inserted.
   */
  public constructor(props: SubCategoryProps, iModel: IModelDb) {
    super(props, iModel);
    this.appearance = new Appearance(props.appearance);
    this.description = JsonUtils.asString(props.description);
  }

  /** @hidden */
  public toJSON(): SubCategoryProps {
    const val = super.toJSON();
    val.appearance = this.appearance.toJSON();
    if (this.description && this.description.length > 0)
      val.description = this.description;
    return val;
  }

  /** Get the SubCategory's Code value. That is the name of the SubCategory. */
  public getSubCategoryName(): string { return this.code.getValue(); }
  /** Get the unique ID of the SubCategory. */
  public getSubCategoryId(): Id64 { return this.id; }
  /** Get the ID of the parent Category. */
  public getCategoryId(): Id64 { return this.parent ? this.parent.id : new Id64(); }
  /** Query if this is the default SubCategory of its parent Category. */
  public isDefaultSubCategory(): boolean { return IModelDb.getDefaultSubCategoryId(this.getCategoryId()).equals(this.getSubCategoryId()); }
}

/** Parameters to create a Category element */
export interface CategoryProps extends ElementProps {
  rank?: Rank;
  description?: string;
}

/** a Category for a Geometric element */
export class Category extends DefinitionElement implements CategoryProps {
  public rank: Rank = Rank.User;
  public constructor(props: CategoryProps, iModel: IModelDb) {
    super(props, iModel);
    this.rank = JsonUtils.asInt(props.rank);
    this.description = JsonUtils.asString(props.description);
  }

  /** @hidden */
  public toJSON(): CategoryProps {
    const val = super.toJSON();
    val.rank = this.rank;
    if (this.description && this.description.length > 0)
      val.description = this.description;
    return val;
  }

  /** Get the ID of the default SubCategory for this Category. */
  public myDefaultSubCategoryId(): Id64 { return IModelDb.getDefaultSubCategoryId(this.id); }

  /** Set the appearance of the default SubCategory for this Category */
  public setDefaultAppearance(app: Appearance): void {
    const subCat: SubCategory = this.iModel.elements.getElement(this.myDefaultSubCategoryId()).copyForEdit();
    subCat.appearance = app;
    this.iModel.elements.updateElement(subCat);
  }
}

/** Categorizes 2d graphical elements. */
export class DrawingCategory extends Category {
  /** Construct a DrawingCategory
   * @param opts  The properties of the new DrawingCategory
   * @param iModel The IModelDb where the DrawingCategory may be inserted.
   */
  public constructor(opts: ElementProps, iModel: IModelDb) { super(opts, iModel); }

  /** Get the name of the CodeSpec that is used by DrawingCategory objects. */
  public static getCodeSpecName(): string { return BisCodeSpec.drawingCategory; }

  /** Create a Code for a DrawingCategory given a name that is meant to be unique within the scope of the specified DefinitionModel.
   * @param imodel  The IModel
   * @param scopeModel The scope of the category.
   * @param codeValue The name of the category
   * @return A drawing category Code
   */
  public static createCode(scopeModel: DefinitionModel, codeValue: string): Code {
    const codeSpec = scopeModel.iModel.codeSpecs.getByName(DrawingCategory.getCodeSpecName());
    return new Code({ spec: codeSpec.id, scope: scopeModel.id.toString(), value: codeValue });
  }
}

/** Categorizes SpatialElements. */
export class SpatialCategory extends Category {
  /** Construct a SpatialCategory
   * @param opts  The properties of the new SpatialCategory
   * @param iModel The IModelDb where the SpatialCategory may be inserted.
   */
  public constructor(opts: ElementProps, iModel: IModelDb) { super(opts, iModel); }

  /** Get the name of the CodeSpec that is used by SpatialCategory objects. */
  public static getCodeSpecName(): string { return BisCodeSpec.spatialCategory; }

  /** Looks up the CategoryId of a SpatialCategory by model and name */
  public static queryCategoryIdByName(scopeModel: DefinitionModel, categoryName: string): Id64 | undefined {
    const code = SpatialCategory.createCode(scopeModel, categoryName);
    return scopeModel.iModel.elements.queryElementIdByCode(code);
  }

  /** Create a Code for a SpatialCategory given a name that is meant to be unique within the scope of the specified DefinitionModel.
   * @param imodel  The IModel
   * @param scopeModel The scope of the category.
   * @param codeValue The name of the category
   * @return A spatial category Code
   */
  public static createCode(scopeModel: DefinitionModel, codeValue: string): Code {
    const codeSpec = scopeModel.iModel.codeSpecs.getByName(SpatialCategory.getCodeSpecName());
    return new Code({ spec: codeSpec.id, scope: scopeModel.id.toString(), value: codeValue });
  }

  /**
   * Create a new SpatialCategory element.
   * @param scopeModel The model in which the category element will be inserted by the caller.
   * @param categoryName The name of the category.
   * @return a new, non-persistent SpatialCategory element.
   */
  public static create(scopeModel: DefinitionModel, categoryName: string): SpatialCategory {
    return scopeModel.iModel.elements.createElement({
      iModel: scopeModel.iModel,
      classFullName: SpatialCategory.classFullName,
      model: scopeModel.id,
      code: SpatialCategory.createCode(scopeModel, categoryName),
    }) as SpatialCategory;
  }
}
