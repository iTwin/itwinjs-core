/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { registerEcClass } from "./EcRegistry";
import { DefinitionElement, IElement } from "./Element";
import { BisCore } from "./BisCore";
import { ColorDef } from "./Render";
import { Id } from "./IModel";
import { JsonUtils } from "@bentley/bentleyjs-common/lib/JsonUtils";

export interface IAppearance {
  color: ColorDef;
  invisible?: boolean;
  dontPlot?: boolean;
  dontSnap?: boolean;
  dontLocate?: boolean;
  weight?: number;
  style?: Id;
  priority?: number;
  material?: Id;
  transp?: number;
}

/** A SubCategory appearance */
export class Appearance {
  public color: ColorDef = ColorDef.black();
  public weight: number = 0;
  public priority: number = 0;
  public transparency: number = 0;
  public invisible: boolean = false;
  public dontPlot: boolean = false;
  public dontSnap: boolean = false;
  public dontLocate: boolean = false;
  public styleId: Id = new Id();
  public materialId: Id = new Id();

  constructor(opts?: IAppearance) {
    if (!opts)
      return;

    this.invisible = JsonUtils.asBool(opts.invisible);
    this.dontSnap = JsonUtils.asBool(opts.dontSnap);
    this.dontLocate = JsonUtils.asBool(opts.dontLocate);
    this.dontPlot = JsonUtils.asBool(opts.dontPlot);
    this.color = ColorDef.fromJSON(opts.color);
    this.weight = JsonUtils.asInt(opts.weight);
    if (opts.style)
      this.styleId = new Id(opts.style);
    this.priority = JsonUtils.asInt(opts.priority);
    if (opts.material)
      this.materialId = new Id(opts.material);
    this.transparency = JsonUtils.asInt(opts.transp);
  }

  public equals(other: Appearance): boolean {
    return this.invisible === other.invisible &&
      this.dontPlot === other.dontPlot &&
      this.dontSnap === other.dontSnap &&
      this.dontLocate === other.dontLocate &&
      this.color.equals(other.color) &&
      this.weight === other.weight &&
      this.priority === other.priority &&
      this.styleId.equals(other.styleId) &&
      this.materialId.equals(other.materialId) &&
      this.transparency === other.transparency;
  }

  public static fromJSON(json: any): Appearance {
    return new Appearance(json);
  }

  public toJSON(): any {
    const val: any = {};
    if (this.invisible) val.invisible = true;
    if (this.dontPlot) val.dontPlot = true;
    if (this.dontSnap) val.dontSnap = true;
    if (this.dontLocate) val.dontLocate = true;
    if (!ColorDef.black().equals(this.color)) val.color = this.color;
    if (0 !== this.weight) val.weight = this.weight;
    if (this.styleId.isValid()) val.style = this.styleId;
    if (0 !== this.priority) val.priority = this.priority;
    if (this.materialId.isValid()) val.material = this.materialId;
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

  public toJSON(): any {
    const val: any = {};
    if (this._invisible) val.invisible = this._value.invisible;
    if (this._color) val.color = this._value.color;
    if (this._weight) val.weight = this._value.weight;
    if (this._style) val.style = this._value.styleId;
    if (this._material) val.material = this._value.materialId;
    if (this._priority) val.priority = this._value.priority;
    if (this._transp) val.transp = this._value.transparency;
    return val;
  }

  public static fromJSON(json: any): SubCategoryOverride {
    const val = new SubCategoryOverride();
    if (!json)
      return val;

    if (json.invisible) val.setInvisible(JsonUtils.asBool(json.invisible));
    if (json.color) val.setColor(ColorDef.fromJSON(json.color));
    if (json.weight) val.setWeight(JsonUtils.asInt(json.weight));
    if (json.style) val.setStyle(new Id(json.style));
    if (json.material) val.setMaterial(new Id(json.material));
    if (json.priority) val.setDisplayPriority(JsonUtils.asInt(json.priority));
    if (json.transp) val.setTransparency(JsonUtils.asDouble(json.transp));
    return val;
  }
}

export interface ISubCategory extends IElement {
  appearance?: Appearance;
  categoryId?: Id;
}

/** a Subcategory defines the appearance for graphics in Geometric elements */
@registerEcClass(BisCore.SubCategory)
export class SubCategory extends DefinitionElement {
  public appearance: Appearance;
  public categoryId: Id;
  public constructor(opts: ISubCategory) {
    super(opts);
    this.appearance = Appearance.fromJSON(opts.appearance);
    this.categoryId = new Id(opts.categoryId);
  }

  public getSubCategoryName(): string { return this.code.getValue(); }
  public getSubCategoryId(): Id { return this.id; }
  public getCategoryId(): Id { return this.parent ? this.parent.id : new Id(); }
  public isDefaultSubCategory(): boolean {
    return Category.getDefaultSubCategoryId(this.getCategoryId()) === this.getSubCategoryId();
  }
}

/** the rank for a Category */
export enum Rank {
  System = 0,       // This category is predefined by the system
  Domain = 1,       // This category is defined by a domain. Elements in this category may be unknown to system functionality.
  Application = 2,  // This category is defined by an application. Elements in this category may be unknown to system and domain functionality.
  User = 3,         // This category is defined by a user. Elements in this category may be unknown to system, domain, and application functionality.
}

/** a Category for a Geometric element */
@registerEcClass(BisCore.Category)
export class Category extends DefinitionElement {
  public rank: Rank = Rank.User;

  public constructor(opts: IElement) { super(opts); }
  public static getDefaultSubCategoryId(id: Id): Id {
    return id.isValid() ? new Id(id.lo, id.hi + 1) : new Id();
  }
  public myDefaultSubCategoryId(): Id { return Category.getDefaultSubCategoryId(this.id); }
}

/** Categorizes 2d graphical elements. */
@registerEcClass(BisCore.DrawingCategory)
export class DrawingCategory extends Category {
  public constructor(opts: IElement) { super(opts); }
}

/** Categorizes a SpatialElement. */
@registerEcClass(BisCore.SpatialCategory)
export class SpatialCategory extends Category {
  public constructor(opts: IElement) { super(opts); }
}
