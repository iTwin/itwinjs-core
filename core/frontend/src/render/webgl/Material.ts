/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { ColorDef, RenderMaterial } from "@itwin/core-common";
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
 * The rest are passed as a varying vec4 to be applied in the fragment shader.
 * All but the specular exponent are compressed such that floats in [0..1] become integers in [0..255] and concatenated bitwise in pairs into 16-bit integer values.
 *
 * The result is:
 *  x: diffuse and specular weights
 *  y: texture weight and specular red
 *  z: specular green and blue
 *  w: specular exponent
 *
 * This packing is motivated by the limited max number of varying vectors guaranteed by WebGL.
 * A varying is used because:
 *  1. Material atlases require looking up the material associated with a particular vertex; and
 *  2. The vertex material may be replaced with a default material based on other criteria such as view flags and feature symbology overrides.
 * @internal
 */
export class Material extends RenderMaterial {
  public static readonly default: Material = new Material(RenderMaterial.Params.defaults);

  // Used for type-switching vs MaterialAtlas
  public readonly isAtlas: false = false;
  public readonly fragUniforms = new Float32Array(4);
  public readonly rgba = new Float32Array(4);

  public get overridesRgb() { return this.rgba[0] >= 0; }
  public get overridesAlpha() { return this.rgba[3] >= 0; }
  public get hasTranslucency() { return this.overridesAlpha && this.rgba[3] < 1; }

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

    const alpha = undefined !== params.alpha ? params.alpha : -1;
    this.rgba[3] = alpha;

    const scale = (value: number) => Math.floor(value * 255 + 0.5);
    this.setInteger(scale(params.diffuse), scale(params.specular), 0);

    const textureWeight = undefined !== this.textureMapping ? this.textureMapping.params.weight : 1.0;
    const specularRgb = undefined !== params.specularColor ? params.specularColor : ColorDef.white;
    const specularColors = specularRgb.colors;
    this.setInteger(scale(textureWeight), specularColors.r, 1);
    this.setInteger(specularColors.g, specularColors.b, 2);

    this.fragUniforms[3] = params.specularExponent;
  }

  private setInteger(loByte: number, hiByte: number, index: number): void {
    const clamp = (x: number) => Math.floor(Math.min(255, (Math.max(x, 0))));

    loByte = clamp(loByte);
    hiByte = clamp(hiByte);

    this.fragUniforms[index] = loByte + hiByte * 256;
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
