/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { JsonUtils } from "@bentley/bentleyjs-core/lib/JsonUtils";
import { CodeSpecNames, Code } from "../common/Code";
import { ElementProps } from "../common/ElementProps";
import { Appearance, Rank } from "../common/SubCategoryAppearance";
import { DefinitionElement } from "./Element";
import { IModelDb } from "./IModelDb";
import { DefinitionModel } from "./Model";

/** Parameters to create a SubCategory element */
export interface SubCategoryProps extends ElementProps {
  appearance?: Appearance;
  description?: string;
}

/** a Subcategory defines the appearance for graphics in Geometric elements */
export class SubCategory extends DefinitionElement implements SubCategoryProps {
  public appearance: Appearance;
  public description?: string;
  public constructor(props: SubCategoryProps, iModel: IModelDb) {
    super(props, iModel);
    this.appearance = new Appearance(props.appearance);
    this.description = JsonUtils.asString(props.description);
  }
  public toJSON(): SubCategoryProps {
    const val = super.toJSON();
    val.appearance = this.appearance;
    if (this.description && this.description.length > 0)
      val.description = this.description;
    return val;
  }

  public getSubCategoryName(): string { return this.code.getValue(); }
  public getSubCategoryId(): Id64 { return this.id; }
  public getCategoryId(): Id64 { return this.parent ? this.parent.id : new Id64(); }
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
  public toJSON(): CategoryProps {
    const val = super.toJSON();
    val.rank = this.rank;
    if (this.description && this.description.length > 0)
      val.description = this.description;
    return val;
  }

  public myDefaultSubCategoryId(): Id64 { return IModelDb.getDefaultSubCategoryId(this.id); }

  /** Set the default appearance of this category */
  public setDefaultAppearance(app: Appearance) {
    const subCat = this.iModel.elements.getElement(this.id).copyForEdit() as SubCategory;
    subCat.appearance = app;
    this.iModel.elements.updateElement(subCat);
  }
}

/** Categorizes 2d graphical elements. */
export class DrawingCategory extends Category {
  public constructor(opts: ElementProps, iModel: IModelDb) { super(opts, iModel); }
  public static getCodeSpecName(): string { return CodeSpecNames.DrawingCategory(); }

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
  public constructor(opts: ElementProps, iModel: IModelDb) { super(opts, iModel); }
  public static getCodeSpecName(): string { return CodeSpecNames.SpatialCategory(); }

  /** Looks up the CategoryId of a SpatialCategory by model and name */
  public static queryCategoryIdByName(parentModel: DefinitionModel, categoryName: string): Id64 | undefined {
    const code = SpatialCategory.createCode(parentModel, categoryName);
    return parentModel.iModel.elements.queryElementIdByCode(code);
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
   * @param parentModel The model in which the category element will be inserted by the caller.
   * @param categoryName The name of the category.
   * @param scopeModel  Optional. You can pass in the model that is to be the scope of the category's code. This defaults to parentModel.
   * @return a new, non-persistent SpatialCategory element.
   */
  public static create(parentModel: DefinitionModel, categoryName: string, scopeModel?: DefinitionModel): SpatialCategory {
    if (undefined === scopeModel)
      scopeModel = parentModel;
    return parentModel.iModel.elements.createElement({
      iModel: parentModel.iModel,
      classFullName: "BisCore:SpatialCategory",
      model: scopeModel.id,
      code: SpatialCategory.createCode(scopeModel, categoryName),
    }) as SpatialCategory;
  }

  /** Inserts this SpatialCategory into the iModel and initializes its default sub-category with the specified appearance.
   * @return The persistent SpatialCategory.
   * @throws IModelError if insert failed.
   * @see setDefaultAppearance
   */
  public insert(): Id64 { return this.iModel.elements.insertElement(this); }
}
