/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { ColorDef, RenderMaterial } from "@bentley/imodeljs-common";

/** Parameters describing a single material. The parameters used are:
 *  - diffuse color rgb (vec3).
 *  - alpha (float in [0..1])
 *  - is rgb overridden (bool)
 *  - is alpha overridden (bool)
 *  - specular exponent (float).
 *  - specular color (vec3).
 *  - specular weight (float in [0..1])
 *  - diffuse weight (float in [0..1])
 *  - texture weight (float in [0..1])
 *
 * These are compressed into a vec4 and a float. Floats in [0..1] become integers in [0..255] and are concatenated using bitwise operations into 24-bit integer values.
 * The result is:
 *  uniform float: specular weight
 *  uniform vec4: the rest:
 *    x: rgb
 *    y: weights
 *      0: texture
 *      1: diffuse
 *      2: specular
 *    z: specular rgb
 *    w: alpha and override flags
 *      0: alpha
 *      1: flags (bit 1: rgb overridden, bit 2: alpha overridden)
 *
 * This format is primarily used to mirror that used by material atlases (textures which contain multiple materials) as those are more heavily constrained by limits
 * on number of varying vectors - but it also reduces the number of uniforms required for singular materials.
 * @internal
 */
export class Material extends RenderMaterial {
  public static readonly default: Material = new Material(RenderMaterial.Params.defaults);

  public readonly overridesRgb: boolean;
  public readonly overridesAlpha: boolean;
  public get hasTranslucency() { return this.overridesAlpha; } // NB: This used to check alpha < 1.0 but that is *always* true if overridesAlpha is true (see constructor).
  public readonly integerUniforms = new Float32Array(4);
  public readonly specularExponent: number;

  public constructor(params: RenderMaterial.Params) {
    super(params);

    const rgb = params.diffuseColor;
    this.overridesRgb = undefined !== rgb;
    if (undefined !== rgb)
      this.setRgb(rgb, 0);

    const scale = (value: number) => Math.floor(value * 255 + 0.5);
    const textureWeight = undefined !== this.textureMapping ? this.textureMapping.params.weight : 1.0;
    this.setInteger(scale(textureWeight), scale(params.diffuse), scale(params.specular), 1);

    if (undefined !== params.specularColor)
      this.setRgb(params.specularColor, 2);
    else
      this.setInteger(255, 255, 255, 2);

    const alpha = 1.0 - params.transparency; // params.transparency of 0.0 indicates alpha not overridden.
    this.overridesAlpha = 1.0 !== alpha;
    const flags = (this.overridesRgb ? 1 : 0) + (this.overridesAlpha ? 2 : 0);
    this.setInteger(scale(alpha), flags, 0, 3);

    this.specularExponent = params.specularExponent;
  }

  private setInteger(loByte: number, midByte: number, hiByte: number, index: number): void {
    const clamp = (x: number) => Math.floor(Math.min(255, (Math.max(x, 0))));

    loByte = clamp(loByte);
    midByte = clamp(midByte);
    hiByte = clamp(hiByte);

    this.integerUniforms[index] = loByte + midByte * 256 + hiByte * 256 * 256;
  }

  private setRgb(rgb: ColorDef, index: number): void {
    const colors = rgb.colors;
    this.setInteger(colors.r, colors.g, colors.b, index);
  }
}

Object.freeze(Material.default);
