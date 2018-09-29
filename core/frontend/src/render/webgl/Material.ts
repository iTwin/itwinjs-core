/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { ColorDef, RenderMaterial } from "@bentley/imodeljs-common";

export class Material extends RenderMaterial {
  public static readonly default: Material = new Material(RenderMaterial.Params.defaults);

  public readonly diffuseUniform = new Float32Array(4); // [red, green, blue, overridden]
  public readonly reflectColor?: ColorDef;
  public readonly alphaUniform = new Float32Array(2); // [alpha, overridden]
  public readonly specular = new Float32Array(4); // [red, green, blue, exponent]
  public readonly weights = new Float32Array(3);  // [diffuse weight, specular weight, reflect]

  public get textureWeight(): number { return undefined !== this.textureMapping ? this.textureMapping.params.weight : 1.0; }
  public get overridesRgb(): boolean { return 1.0 === this.diffuseUniform[3]; }
  public get overridesAlpha(): boolean { return 1.0 === this.alphaUniform[1]; }
  public get hasTranslucency(): boolean { return this.overridesAlpha && this.alphaUniform[0] < 1.0; }

  public constructor(materialParams: RenderMaterial.Params) {
    super(materialParams);

    this.diffuseUniform[3] = undefined !== materialParams.diffuseColor ? 1.0 : 0.0;
    if (undefined !== materialParams.diffuseColor) {
      const diffRgb = materialParams.diffuseColor.colors;
      this.diffuseUniform[0] = diffRgb.r / 255;
      this.diffuseUniform[1] = diffRgb.g / 255;
      this.diffuseUniform[2] = diffRgb.b / 255;
    } else {
      this.diffuseUniform[0] = this.diffuseUniform[1] = this.diffuseUniform[2] = 1.0;
    }

    this.specular[3] = materialParams.specularExponent;
    if (materialParams.specularColor) {
      const specRgb = materialParams.specularColor.colors;
      this.specular[0] = specRgb.r / 255;
      this.specular[1] = specRgb.g / 255;
      this.specular[2] = specRgb.b / 255;
    } else {
      this.specular[0] = this.specular[1] = this.specular[2] = 1.0;
    }

    if (materialParams.reflectColor)
      this.reflectColor = materialParams.reflectColor.clone();

    this.weights[0] = materialParams.diffuse;
    this.weights[1] = materialParams.specular;
    this.weights[2] = materialParams.reflect;

    if (0.0 !== materialParams.transparency) {
      this.alphaUniform[0] = 1.0 - materialParams.transparency;
      this.alphaUniform[1] = 1.0;
    } else {
      this.alphaUniform[0] = 1.0;
      this.alphaUniform[1] = 0.0;
    }
  }
}

Object.freeze(Material.default);
