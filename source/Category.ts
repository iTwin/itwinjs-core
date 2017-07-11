/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { DefinitionElement, CreateParams } from "./Element";
import { ColorDef, Id, JsonUtils } from "./IModel";

/** A SubCategory appearance */
export class Appearance {
  public color: ColorDef;
  constructor(public invisible?: boolean, public dontPlot?: boolean, public dontSnap?: boolean, public dontLocate?: boolean, color?: ColorDef,
    public weight?: number, public styleId?: Id, public priority?: number, public materialId?: Id, public transparency?: number) { this.color = color ? color : ColorDef.black(); }

  public equals(other: Appearance): boolean {
    return this.invisible === other.invisible &&
      this.dontPlot === other.dontPlot &&
      this.dontSnap === other.dontSnap &&
      this.dontLocate === other.dontLocate &&
      this.color.equals(other.color) &&
      this.weight === other.weight &&
      this.styleId === other.styleId &&
      this.priority === other.priority &&
      this.materialId === other.materialId &&
      this.transparency === other.transparency;
  }

  public static fromJSON(json: any): Appearance {
    const val = new Appearance();
    if (!json)
      return val;

    val.invisible = JsonUtils.asBool(json.invisible);
    val.dontSnap = JsonUtils.asBool(json.dontSnap);
    val.dontLocate = JsonUtils.asBool(json.dontLocate);
    val.color = new ColorDef(JsonUtils.asInt(val.color));
    val.weight = JsonUtils.asInt(json.weight);
    if (json.style != null)
      val.styleId = new Id(json.style);
    val.priority = JsonUtils.asInt(json.priority);
    if (json.material != null)
      val.materialId = new Id(json.material);
    val.transparency = JsonUtils.asInt(json.transp);
    return val;
  }

  public toJSON(): any {
    const val: any = {};
    if (this.invisible) val.invisible = true;
    if (this.dontPlot) val.dontPlot = true;
    if (this.dontSnap) val.dontSnap = true;
    if (this.dontLocate) val.dontLocate = true;
    if (!ColorDef.black().equals(this.color)) val.color = this.color.rgba;
    if (0 !== this.weight) val.weight = this.weight;
    if (this.styleId) val.style = this.styleId.toString();
    if (0 !== this.priority) val.priority = this.priority;
    if (this.materialId) val.material = this.materialId.toString();
    if (0.0 !== this.transparency) val.transp = this.transparency;
    return val;
  }
}

/** the SubCategory appearance overrides for a view */
export class SubCategoryOverride {
  private _value: Appearance;
  private _invisible?: boolean;
  private _color?: boolean;
  private _weight?: boolean;
  private _style?: boolean;
  private _priority?: boolean;
  private _material?: boolean;
  private _transp?: boolean;

  constructor() { this._value = new Appearance(); }
  public setInvisible(val: boolean): void { this._invisible = true; this._value.invisible = val; }
  public setColor(val: ColorDef): void { this._color = true; this._value.color = val; }
  public setWeight(val: number): void { this._weight = true; this._value.weight = val; }
  public setStyle(val: Id) { this._style = true; this._value.styleId = val; }
  public setDisplayPriority(val: number) { this._priority = true; this._value.priority = val; }
  public setMaterial(val: Id) { this._material = true; this._value.materialId = val; }
  public setTransparency(val: number) { this._transp = true; this._value.transparency = val; }
  public applyTo(appear: Appearance): void {
    if (this._invisible) appear.invisible = this._value.invisible;
    if (this._color) appear.color = this._value.color;
    if (this._weight) appear.weight = this._value.weight;
    if (this._style) appear.styleId = this._value.styleId;
    if (this._material) appear.materialId = this._value.materialId;
    if (this._priority) appear.priority = this._value.priority;
    if (this._transp) appear.transparency = this._value.transparency;
  }
}

export interface SubCategoryCreateParams extends CreateParams {
  appear?: Appearance;
  categoryId?: Id;
}

/** a Subcategory defines the appearance for graphics in Geometric elements */
export class SubCategory extends DefinitionElement {
  public appearance: Appearance;
  public categoryId: Id;
  public constructor(opts: SubCategoryCreateParams) {
    super(opts);
    this.appearance = opts.appear ? opts.appear : new Appearance();
    this.categoryId = opts.categoryId ? opts.categoryId : new Id();
  }

  public getSubCategoryName(): string {
    return this.code.getValue();
  }

  public getSubCategoryId(): Id { return this.id; }
  public getCategoryId(): Id { return this.parent ? this.parent.id : new Id(); }
  public isDefaultSubCategory(): boolean {
    return Category.getDefaultSubCategoryId(this.getCategoryId()) === this.getSubCategoryId();
  }
  protected getEcClass(): string { return "SubCategory"; }
}

/** the rank for a Category */
export enum Rank {
  System = 0,       // This category is predefined by the system
  Domain = 1,       // This category is defined by a domain. Elements in this category may be unknown to system functionality.
  Application = 2,  // This category is defined by an application. Elements in this category may be unknown to system and domain functionality.
  User = 3,         // This category is defined by a user. Elements in this category may be unknown to system, domain, and application functionality.
}

/** a Category for a Geometric element */
export class Category extends DefinitionElement {
  public rank: Rank = Rank.User;

  public constructor(opts: CreateParams) { super(opts); }
  public static getDefaultSubCategoryId(id: Id): Id {
    return id.isValid() ? new Id(id.lo, id.hi + 1) : new Id();
  }
  public myDefaultSubCategoryId(): Id { return Category.getDefaultSubCategoryId(this.id); }

  protected getEcClass(): string { return "Category"; }
}

/** Categorizes 2d graphical elements. */
export class DrawingCategory extends Category {
  protected getEcClass(): string { return "DrawingCategory"; }
  public constructor(opts: CreateParams) { super(opts); }
}

/** Categorizes a SpatialElement. */
export class SpatialCategory extends Category {
  protected getEcClass(): string { return "SpatialCategory"; }
  public constructor(opts: CreateParams) { super(opts); }
}
