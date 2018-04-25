/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Views */

import { assert } from "@bentley/bentleyjs-core";
import { ColorDef } from "./ColorDef";

export class ColorIndexNonUniform {
  public colors: Uint32Array;
  public indices: Uint16Array;
  public hasAlpha: boolean;
  public constructor(colors: Uint32Array, indices: Uint16Array, hasAlpha: boolean) {
    this.colors = new Uint32Array(colors.buffer);
    this.indices = new Uint16Array(indices.buffer);
    this.hasAlpha = hasAlpha;
  }
}

export class ColorIndex {
  public numColors: number = 1;
  public uniform: number = 0x00ffffff;
  public nonUniform: ColorIndexNonUniform | undefined;
  public constructor() {
    this.reset();
  }
  public isValid(): boolean { return this.numColors > 0; }
  public isUniform(): boolean {
    assert(this.numColors > 0);
    return this.numColors === 1;
  }
  public hasAlpha(): boolean {
    if (this.isUniform())
      return (0 !== (this.uniform & 0xff000000));
    else {
      assert(undefined !== this.nonUniform);
      if (undefined !== this.nonUniform)
        return this.nonUniform.hasAlpha;
      else
        return false;
    }
  }
  public reset() {
    this.numColors = 1;
    this.uniform = ColorDef.white.tbgr;
    this.nonUniform = undefined;
  }
  public setUniform(color: number | ColorDef) {
    if (typeof color === "number") {
      this.numColors = 1;
      this.uniform = color;
      this.nonUniform = undefined;
    } else {
      this.setUniform(color.tbgr);
    }
  }
  public setNonUniform(numColors: number, colors: Uint32Array, indices: Uint16Array, hasAlpha: boolean) {
    assert(numColors > 1);
    this.numColors = numColors;
    this.nonUniform = new ColorIndexNonUniform(colors, indices, hasAlpha);
    this.uniform = 0;
  }
}

export const enum FeatureIndexType {
  kEmpty,
  kUniform,
  kNonUniform,
}

export class FeatureIndex {
  public type: FeatureIndexType = FeatureIndexType.kEmpty;
  public featureID: number = 0;
  public featureIDs: Uint32Array | undefined = undefined;

  public constructor() {
    this.reset();
  }

  public isUniform(): boolean { return FeatureIndexType.kUniform === this.type; }
  public isEmpty(): boolean { return FeatureIndexType.kEmpty === this.type; }
  public reset(): void { this.type = FeatureIndexType.kEmpty; this.featureID = 0; this.featureIDs = undefined; }
}
