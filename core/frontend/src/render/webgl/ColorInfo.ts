/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { assert } from "@bentley/bentleyjs-core";
import { FloatPreMulRgba } from "./FloatRGBA";
import { ColorIndex } from "@bentley/imodeljs-common";

/* Describes a primitive's basic color properties */
export class ColorInfo {
  public readonly _uniform?: FloatPreMulRgba;
  public readonly hasTranslucency: boolean;

  public constructor(arg: FloatPreMulRgba | ColorIndex) {
    if (arg instanceof FloatPreMulRgba) {
      this.hasTranslucency = arg.hasTranslucency;
      this._uniform = arg;
    } else {
      this.hasTranslucency = arg.hasAlpha;
      if (undefined !== arg.uniform) {
        this._uniform = FloatPreMulRgba.fromColorDef(arg.uniform);
      }
    }
  }

  public get isUniform() { return undefined !== this._uniform; }
  public get isNonUniform() { return !this.isUniform; }
  public get uniform(): FloatPreMulRgba { assert(this.isUniform); return this._uniform!; }
}
