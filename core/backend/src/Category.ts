/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Categories */

import { Id64, Id64String, JsonUtils } from "@bentley/bentleyjs-core";
import { BisCodeSpec, Code, CodeScopeProps, CodeSpec, ElementProps, SubCategoryAppearance, Rank, SubCategoryProps, CategoryProps } from "@bentley/imodeljs-common";
import { DefinitionElement } from "./Element";
import { IModelDb } from "./IModelDb";
import { DefinitionModel } from "./Model";

/** Defines the appearance for graphics in Geometric elements */
export class SubCategory extends DefinitionElement {
  /** The Appearance parameters for this SubCategory */
  public appearance: SubCategoryAppearance;
  /** Optional description of this SubCategory. */
  public description?: string;

  /** Construct a SubCategory.
   * @param props The properties of the SubCategory
   * @param iModel The IModelDb for the SubCategory
   * @hidden
   */
  public constructor(props: SubCategoryProps, iModel: IModelDb) {
    super(props, iModel);
    this.appearance = new SubCategoryAppearance(props.appearance);
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

  /** Get the SubCategory's name (its Code value). */
  public getSubCategoryName(): string { return this.code.getValue(); }
  /** Get the Id of the SubCategory. */
  public getSubCategoryId(): Id64 { return this.id; }
  /** Get the Id of this SubCategory's parent Category. */
  public getCategoryId(): Id64 { return this.parent ? this.parent.id : new Id64(); }
  /** Check if this is the default SubCategory of its parent Category. */
  public get isDefaultSubCategory(): boolean { return IModelDb.getDefaultSubCategoryId(this.getCategoryId()).equals(this.getSubCategoryId()); }
}

/** A Category element is the target of the `category` member of [[GeometricElement]]. */
export class Category extends DefinitionElement implements CategoryProps {
  public rank: Rank = Rank.User;

  /** @hidden */
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

  /** Get the Id of the default SubCategory for this Category. */
  public myDefaultSubCategoryId(): Id64 { return IModelDb.getDefaultSubCategoryId(this.id); }

  /** Set the appearance of the default SubCategory for this Category */
  public setDefaultAppearance(app: SubCategoryAppearance): void {
    const subCat: SubCategory = this.iModel.elements.getElement(this.myDefaultSubCategoryId()).clone();
    subCat.appearance = app;
    this.iModel.elements.updateElement(subCat);
  }
}

/** Categorizes 2d GeometricElements. */
export class DrawingCategory extends Category {
  /** Construct a DrawingCategory
   * @param opts  The properties of the new DrawingCategory
   * @param iModel The IModelDb where the DrawingCategory may be inserted.
   * @hidden
   */
  public constructor(opts: ElementProps, iModel: IModelDb) { super(opts, iModel); }

  /** Get the name of the CodeSpec that is used by DrawingCategory objects. */
  public static getCodeSpecName(): string { return BisCodeSpec.drawingCategory; }

  /** Looks up the CategoryId of a DrawingCategory by model and name */
  public static queryCategoryIdByName(iModel: IModelDb, scopeModelId: Id64String, categoryName: string): Id64 | undefined {
    const code: Code = DrawingCategory.createCode(iModel, scopeModelId, categoryName);
    return iModel.elements.queryElementIdByCode(code);
  }

  /** Create a Code for a DrawingCategory given a name that is meant to be unique within the scope of the specified DefinitionModel.
   * @param iModel  The IModel
   * @param scopeModelId The Id of the DefinitionModel that contains the DrawingCategory and provides the scope for its name.
   * @param codeValue The name of the category
   * @return A drawing category Code
   */
  public static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code {
    const codeSpec: CodeSpec = iModel.codeSpecs.getByName(DrawingCategory.getCodeSpecName());
    return new Code({ spec: codeSpec.id, scope: scopeModelId, value: codeValue });
  }
}

/** Categorizes SpatialElements. See [how to create a SpatialCategory]$(docs/learning/backend/CreateElements.md#SpatialCategory). */
export class SpatialCategory extends Category {
  /** Construct a SpatialCategory
   * @param opts  The properties of the new SpatialCategory
   * @param iModel The IModelDb where the SpatialCategory may be inserted.
   * @hidden
   */
  public constructor(opts: ElementProps, iModel: IModelDb) { super(opts, iModel); }

  /** Get the name of the CodeSpec that is used by SpatialCategory objects. */
  public static getCodeSpecName(): string { return BisCodeSpec.spatialCategory; }

  /** Looks up the CategoryId of a SpatialCategory by model and name */
  public static queryCategoryIdByName(iModel: IModelDb, scopeModelId: Id64String, categoryName: string): Id64 | undefined {
    const code: Code = SpatialCategory.createCode(iModel, scopeModelId, categoryName);
    return iModel.elements.queryElementIdByCode(code);
  }

  /** Create a Code for a SpatialCategory given a name that is meant to be unique within the scope of the specified DefinitionModel.
   * @param iModel  The IModel
   * @param scopeModelId The Id of the DefinitionModel that contains the SpatialCategory and provides the scope for its name.
   * @param codeValue The name of the category
   * @return A spatial category Code
   */
  public static createCode(iModel: IModelDb, scopeModelId: CodeScopeProps, codeValue: string): Code {
    const codeSpec: CodeSpec = iModel.codeSpecs.getByName(SpatialCategory.getCodeSpecName());
    return new Code({ spec: codeSpec.id, scope: scopeModelId, value: codeValue });
  }

  /**
   * Create a new SpatialCategory element.
   * @param scopeModel The model in which the category element will be inserted by the caller.
   * @param categoryName The name of the category.
   * @return A new SpatialCategory element.
   */
  public static create(scopeModel: DefinitionModel, categoryName: string): SpatialCategory {
    return scopeModel.iModel.elements.createElement({
      classFullName: SpatialCategory.classFullName,
      model: scopeModel.id,
      code: SpatialCategory.createCode(scopeModel.iModel, scopeModel.id, categoryName),
    }) as SpatialCategory;
  }
}
