/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { ColorDef, RenderMaterial } from "@bentley/imodeljs-common";
import { SurfaceMaterial, SurfaceMaterialAtlas } from "../primitives/VertexTable";
import { FloatRgb } from "./FloatRGBA";

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
 * The rgb and alpha are applied in the vertex shader. Either can be negative, indicating the material does not override it.
 *
 * The rest are passed as a varying vec3 or uniform vec3 to be applied in the fragment shader.
 * All but the specular exponent are compressed such that floats in [0..1] become integers in [0..255] and concatenated bitwise into 24-bit integer values.
 *
 * The result is:
 *  x: specular rgb
 *  y: specular exponent
 *  z: weights
 *    0: diffuse
 *    1: specular
 *    2: texture
 *
 * This format is primarily used to mirror that used by material atlases (textures which contain multiple materials) as those are more heavily constrained by limits
 * on number of varying vectors - but it also reduces the number of uniforms required for singular materials.
 * @internal
 */
export class Material extends RenderMaterial {
  public static readonly default: Material = new Material(RenderMaterial.Params.defaults);

  // Used for type-switching vs MaterialAtlas
  public readonly isAtlas: false = false;
  public readonly fragUniforms = new Float32Array(3);
  public readonly rgba = new Float32Array(4);

  public get overridesRgb() { return this.rgba[0] >= 0; }
  public get hasTranslucency() { return this.rgba[3] >= 0 && this.rgba[3] < 1; }

  public constructor(params: RenderMaterial.Params) {
    super(params);

    if (undefined !== params.diffuseColor) {
      const rgb = FloatRgb.fromColorDef(params.diffuseColor);
      this.rgba[0] = rgb.red;
      this.rgba[1] = rgb.green;
      this.rgba[2] = rgb.blue;
    } else {
      this.rgba[0] = this.rgba[1] = this.rgba[2] = -1;
    }

    // params.transparency of 0.0 indicates alpha no overridden. Indicated to shader as -1.
    const alpha = 0.0 !== params.transparency ? 1.0 - params.transparency : -1;
    this.rgba[3] = alpha;

    if (undefined !== params.specularColor)
      this.setRgb(params.specularColor, 0);
    else
      this.setInteger(255, 255, 255, 0);

    this.fragUniforms[1] = params.specularExponent;

    const scale = (value: number) => Math.floor(value * 255 + 0.5);
    const textureWeight = undefined !== this.textureMapping ? this.textureMapping.params.weight : 1.0;
    this.setInteger(scale(params.diffuse), scale(params.specular), scale(textureWeight), 2);
  }

  private setInteger(loByte: number, midByte: number, hiByte: number, index: number): void {
    const clamp = (x: number) => Math.floor(Math.min(255, (Math.max(x, 0))));

    loByte = clamp(loByte);
    midByte = clamp(midByte);
    hiByte = clamp(hiByte);

    this.fragUniforms[index] = loByte + midByte * 256 + hiByte * 256 * 256;
  }

  private setRgb(rgb: ColorDef, index: number): void {
    const colors = rgb.colors;
    this.setInteger(colors.r, colors.g, colors.b, index);
  }
}

Object.freeze(Material.default);

/** Describes the material associated with a surface.
 * @internal
 */
export type MaterialInfo = Material | SurfaceMaterialAtlas;

/** @internal */
export function createMaterialInfo(source: SurfaceMaterial | undefined): MaterialInfo | undefined {
  if (undefined === source)
    return undefined;
  else if (source.isAtlas)
    return source;
  else
    return source.material as Material;
}
