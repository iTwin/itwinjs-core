/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { DefinitionElement, CreateParams } from "./Element";
import { ColorDef } from "./IModel";

/** A SubCategory appearance */
export class Appearance {
  public color: ColorDef;
  constructor(public invisible?: boolean, public dontPlot?: boolean, public dontSnap?: boolean, public dontLocate?: boolean, color?: ColorDef,
    public weight?: number, public styleId?: string, public priority?: number, public material?: string, public transp?: number) { this.color = color ? color : new ColorDef(); }

  public equals(other: Appearance): boolean {
    return this.invisible === other.invisible &&
      this.dontPlot === other.dontPlot &&
      this.dontSnap === other.dontSnap &&
      this.dontLocate === other.dontLocate &&
      this.color.equals(other.color) &&
      this.weight === other.weight &&
      this.styleId === other.styleId &&
      this.priority === other.priority &&
      this.material === other.material &&
      this.transp === other.transp;
  }
}

/** the SubCategory appearance overrides for a view */
export class Override {
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
  public setStyle(val: string) { this._style = true; this._value.styleId = val; }
  public setDisplayPriority(val: number) { this._priority = true; this._value.priority = val; }
  public setMaterial(val: string) { this._material = true; this._value.material = val; }
  public setTransparency(val: number) { this._transp = true; this._value.transp = val; }
  public applyTo(appear: Appearance): void {
    if (this._invisible) appear.invisible = this._value.invisible;
    if (this._color) appear.color = this._value.color;
    if (this._weight) appear.weight = this._value.weight;
    if (this._style) appear.styleId = this._value.styleId;
    if (this._material) appear.material = this._value.material;
    if (this._priority) appear.priority = this._value.priority;
    if (this._transp) appear.transp = this._value.transp;
  }
}

export interface SubCategoryCreateParams extends CreateParams {
  appear: Appearance;
  categoryId: string;
}

export class SubCategory extends DefinitionElement {
  public appearance: Appearance;
  public categoryId: string;
  public constructor(opts: SubCategoryCreateParams) {
    super(opts);
    this.appearance = opts.appear;
    this.categoryId = opts.categoryId;
  }

  public getSubCategoryName(): string {
    return (this.code && this.code.value) ? this.code.value : "";
  }

  public getSubCategoryId(): string { return this.id; }
  public getCategoryId(): string { return this.parent ? this.parent.id : ""; }
  public isDefaultSubCategory(): boolean {
    //  return Category::GetDefaultSubCategoryId(this.getCategoryId()) === this.getSubCategoryId();
    return false;
  }
}

export class Category extends DefinitionElement {

}
