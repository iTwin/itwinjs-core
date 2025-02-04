/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { ColorDef, RenderMaterial, TextureMapping } from "@itwin/core-common";
import { FloatRgb } from "./FloatRGBA";
import { SurfaceMaterial, SurfaceMaterialAtlas } from "../../common/internal/render/SurfaceParams";
import { CreateRenderMaterialArgs } from "../CreateRenderMaterialArgs";

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

  public static readonly default: Material = new Material({diffuse: { weight: 0.6 }, specular: { weight: 0.4, exponent: 13.5 }}); // Default material

  // Used for type-switching vs MaterialAtlas
  public readonly isAtlas = false as const;
  public readonly fragUniforms = new Float32Array(4);
  public readonly rgba = new Float32Array(4);

  public get overridesRgb() { return this.rgba[0] >= 0; }
  public get overridesAlpha() { return this.rgba[3] >= 0; }
  public get hasTranslucency() { return this.overridesAlpha && this.rgba[3] < 1; }

  /** Strictly for testing. */
  public static preserveArgs = false;
  /** Strictly for testing. */
  public args?: CreateRenderMaterialArgs;

  public constructor(args: CreateRenderMaterialArgs) {
    const textureMapping = args.textureMapping ?
     new TextureMapping(args.textureMapping.texture, new TextureMapping.Params({
      textureMat2x3: args.textureMapping.transform,
      mapMode: args.textureMapping.mode,
      textureWeight: args.textureMapping.weight,
      worldMapping: args.textureMapping.worldMapping,
      useConstantLod: args.textureMapping.useConstantLod,
      constantLodProps: args.textureMapping.constantLodProps,
    }))
    : undefined;
    super({ ...args, textureMapping });

    if (Material.preserveArgs) {
      this.args = args;
    }

    if (args.diffuse?.color !== undefined) {
      if ( args.diffuse.color instanceof ColorDef ) {
      const rgb = FloatRgb.fromColorDef(args.diffuse.color);
      this.rgba[0] = rgb.red;
      this.rgba[1] = rgb.green;
      this.rgba[2] = rgb.blue;
      } else {
        this.rgba[0] = args.diffuse.color.r;
        this.rgba[1] = args.diffuse.color.g;
        this.rgba[2] = args.diffuse.color.b;
      }
    } else {
      this.rgba[0] = this.rgba[1] = this.rgba[2] = -1;
    }

    const alpha = args.alpha ?? -1;
    this.rgba[3] = alpha;

    const scale = (value: number) => Math.floor(value * 255 + 0.5);

    const diffuseWeight = args.diffuse?.weight ?? 0.6;
    const specularWeight = args.specular?.weight ?? 0.4;
    this.setInteger(scale(diffuseWeight), scale(specularWeight), 0);

    const textureWeight = this.textureMapping !== undefined ? this.textureMapping.params.weight : 1.0;

    const specularRgb = args.specular?.color ?? ColorDef.white;
    if ( specularRgb instanceof ColorDef ) {
      this.setInteger(scale(textureWeight), specularRgb.colors.r, 1);
      this.setInteger(specularRgb.colors.g, specularRgb.colors.b, 2);
    } else {
      this.setInteger(scale(textureWeight), specularRgb.r, 1);
      this.setInteger(specularRgb.g, specularRgb.b, 2);
    }
    this.fragUniforms[3] = args.specular?.exponent ?? 13.5;
  }

  private setInteger(loByte: number, hiByte: number, index: number): void {
    const clamp = (x: number) => Math.floor(Math.min(255, (Math.max(x, 0))));

    loByte = clamp(loByte);
    hiByte = clamp(hiByte);

    this.fragUniforms[index] = loByte + hiByte * 256;
  }
}

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
