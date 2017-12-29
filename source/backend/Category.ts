/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { JsonUtils } from "@bentley/bentleyjs-core/lib/JsonUtils";
import { CodeSpecNames } from "../common/Code";
import { ElementProps } from "../common/ElementProps";
import { Appearance, Rank } from "../common/SubCategoryAppearance";
import { DefinitionElement } from "./Element";
import { IModelDb } from "./IModelDb";

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
}

/** Categorizes 2d graphical elements. */
export class DrawingCategory extends Category {
  public constructor(opts: ElementProps, iModel: IModelDb) { super(opts, iModel); }
  public static getCodeSpecName(): string { return CodeSpecNames.DrawingCategory(); }
}

/** Categorizes SpatialElements. */
export class SpatialCategory extends Category {
  public constructor(opts: ElementProps, iModel: IModelDb) { super(opts, iModel); }
  public static getCodeSpecName(): string { return CodeSpecNames.SpatialCategory(); }
}
