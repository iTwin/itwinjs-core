/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { ColorDef } from "./ColorDef";

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

export class ColorIndex {
  private color: ColorDef | NonUniformColor;

  public get hasAlpha() { return !this.color.isOpaque; }
  public get isUniform() { return this.color instanceof ColorDef; }
  public get numColors(): number { return this.isUniform ? 1 : this.nonUniform!.colors.length; }

  public constructor() { this.color = ColorDef.white.clone(); }

  public reset() { this.color = ColorDef.white.clone(); }

  public get uniform(): ColorDef | undefined { return this.isUniform ? this.color as ColorDef : undefined; }
  public initUniform(color: ColorDef | number) { this.color = ("number" === typeof color) ? new ColorDef(color) : (color as ColorDef).clone(); }

  public get nonUniform(): NonUniformColor | undefined { return !this.isUniform ? this.color as NonUniformColor : undefined; }
  public initNonUniform(colors: Uint32Array, indices: Uint16Array, hasAlpha: boolean) {
    this.color = new NonUniformColor(colors, indices, hasAlpha);
  }
}

export const enum FeatureIndexType {
  Empty,
  Uniform,
  NonUniform,
}

export class FeatureIndex {
  public type: FeatureIndexType = FeatureIndexType.Empty;
  public featureID: number = 0;
  public featureIDs?: Uint32Array;

  public constructor() {
    this.reset();
  }

  public isUniform(): boolean { return FeatureIndexType.Uniform === this.type; }
  public isEmpty(): boolean { return FeatureIndexType.Empty === this.type; }
  public reset(): void { this.type = FeatureIndexType.Empty; this.featureID = 0; this.featureIDs = undefined; }
}
