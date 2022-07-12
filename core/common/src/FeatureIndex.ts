/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { ColorDef } from "./ColorDef";

/** @internal */
export class NonUniformColor {
  public readonly colors: Uint32Array;
  public readonly indices: Uint16Array;
  public readonly isOpaque: boolean;

  public constructor(colors: Uint32Array, indices: number[], hasAlpha: boolean) {
    this.colors = new Uint32Array(colors.buffer);
    this.indices = Uint16Array.from(indices);
    this.isOpaque = !hasAlpha;
  }
}

/** @internal */
export class ColorIndex {
  private _color: ColorDef | NonUniformColor;

  public get hasAlpha() { return !this._color.isOpaque; }
  public get isUniform() { return this._color instanceof ColorDef; }
  public get numColors(): number { return this.isUniform ? 1 : this.nonUniform!.colors.length; }

  public constructor() { this._color = ColorDef.white; }

  public reset() { this._color = ColorDef.white; }

  public get uniform(): ColorDef | undefined {
    return this.isUniform ? this._color as ColorDef : undefined;
  }

  public initUniform(color: ColorDef | number) {
    this._color = typeof color === "number" ? ColorDef.fromJSON(color) : color;
  }

  public get nonUniform(): NonUniformColor | undefined {
    return !this.isUniform ? this._color as NonUniformColor : undefined;
  }

  public initNonUniform(colors: Uint32Array, indices: number[], hasAlpha: boolean) {
    this._color = new NonUniformColor(colors, indices, hasAlpha);
  }
}

/** @internal */
export enum FeatureIndexType {
  Empty,
  Uniform,
  NonUniform,
}

/** @internal */
export class FeatureIndex {
  public type: FeatureIndexType = FeatureIndexType.Empty;
  public featureID: number = 0;
  public featureIDs?: Uint32Array;

  public get isUniform(): boolean { return FeatureIndexType.Uniform === this.type; }
  public get isEmpty(): boolean { return FeatureIndexType.Empty === this.type; }
  public reset(): void { this.type = FeatureIndexType.Empty; this.featureID = 0; this.featureIDs = undefined; }
}
