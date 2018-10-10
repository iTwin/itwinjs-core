/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { ColorDef } from "./ColorDef";

/** @hidden */
export class NonUniformColor {
  public readonly colors: Uint32Array;
  public readonly indices: Uint16Array;
  public readonly isOpaque: boolean;

  public constructor(colors: Uint32Array, indices: Uint16Array, hasAlpha: boolean) {
    this.colors = new Uint32Array(colors.buffer);
    this.indices = new Uint16Array(indices.buffer);
    this.isOpaque = !hasAlpha;
  }
}

/** @hidden */
export class ColorIndex {
  private _color: ColorDef | NonUniformColor;

  public get hasAlpha() { return !this._color.isOpaque; }
  public get isUniform() { return this._color instanceof ColorDef; }
  public get numColors(): number { return this.isUniform ? 1 : this.nonUniform!.colors.length; }

  public constructor() { this._color = ColorDef.white.clone(); }

  public reset() { this._color = ColorDef.white.clone(); }

  public get uniform(): ColorDef | undefined { return this.isUniform ? this._color as ColorDef : undefined; }
  public initUniform(color: ColorDef | number) { this._color = ("number" === typeof color) ? new ColorDef(color) : (color as ColorDef).clone(); }

  public get nonUniform(): NonUniformColor | undefined { return !this.isUniform ? this._color as NonUniformColor : undefined; }
  public initNonUniform(colors: Uint32Array, indices: Uint16Array, hasAlpha: boolean) {
    this._color = new NonUniformColor(colors, indices, hasAlpha);
  }
}

/** @hidden */
export const enum FeatureIndexType {
  Empty,
  Uniform,
  NonUniform,
}

/** @hidden */
export class FeatureIndex {
  public type: FeatureIndexType = FeatureIndexType.Empty;
  public featureID: number = 0;
  public featureIDs?: Uint32Array;

  public constructor() {
    this.reset();
  }

  public get isUniform(): boolean { return FeatureIndexType.Uniform === this.type; }
  public get isEmpty(): boolean { return FeatureIndexType.Empty === this.type; }
  public reset(): void { this.type = FeatureIndexType.Empty; this.featureID = 0; this.featureIDs = undefined; }
}
