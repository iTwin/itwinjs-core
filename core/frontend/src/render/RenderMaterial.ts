/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64String } from "@itwin/core-bentley";
import { ColorDef, NormalMap, RenderTexture, RgbColorProps, TextureMapping } from "@itwin/core-common";
import { IModelConnection } from "../IModelConnection";

/** Specifies the provenance of a [RenderMaterial]($common) created for a persistent material element.
 * @see [[CreateRenderMaterialArgs.source]].
 * @internal
 */
export interface RenderMaterialSource {
  iModel: IModelConnection;
  id: Id64String;
}

/** Describes the [diffuse](https://en.wikipedia.org/wiki/Diffuse_reflection) properties of a [RenderMaterial]($common).
 * @see [[CreateRenderMaterialArgs.diffuse]].
 * @public
 */
export interface MaterialDiffuseProps {
  /** The diffuse color. If defined, this overrides the color of any surface to which the material is applied. */
  color?: ColorDef | RgbColorProps;

  /** A multiplier in [0..1] specifying how strongly the diffuse color reflects light.
   * Default: 0.6
   */
  weight?: number;
}

/** Describes the [specular](https://en.wikipedia.org/wiki/Specular_highlight) properties of a material.
 * @see [[CreateRenderMaterialArgs.specular]].
 * @public
 */
export interface MaterialSpecularProps {
  /** The color of the specular reflections.
   * Default: white.
   */
  color?: ColorDef | RgbColorProps;

  /** A multiplier in [0..1] specifying the strength of the specular reflections.
   * Default: 0.4
   */
  weight?: number;

  /** An exponent in [0..infinity] describing the shininess of the surface.
   * Default: 13.5
   */
  exponent?: number;
}

/** Describes how to map a [RenderTexture]($common)'s image to the surfaces to which a [RenderMaterial]($common) is applied.
 * @see [[CreateRenderMaterialArgs.textureMapping]].
 * @public
 */
export interface MaterialTextureMappingProps {
  /** The texture from which the image is obtained. */
  texture: RenderTexture;

  /** If present, the texture is used as a normal map and normalMap.texture is used as the texture. */
  normalMap?: NormalMap;

  /** The mode controlling how the image is mapped onto the surface.
   * Default: [TextureMapping.Mode.Parametric]($common).
   */
  mode?: TextureMapping.Mode;

  /** A 2x3 matrix for computing the UV coordinates.
   * Default: [TextureMapping.Trans2x3.identity]($common).
   */
  transform?: TextureMapping.Trans2x3;

  /** The ratio by which the color sampled from the texture image is mixed with the surface's or material's diffuse color.
   * A ratio of 1 selects only the texture sample; a ratio of 0 selects only the diffuse color; a ratio of 0.5 mixes them evenly.
   * Default: 1.
   */
  weight?: number;

  /** @internal */
  worldMapping?: boolean;
}

/** Arguments supplied to [[RenderSystem.createRenderMaterial]].
 * @public
 */
export interface CreateRenderMaterialArgs {
  /** If supplied, the material will be cached on the iModel by its element Id for subsequent reuse.
   * @internal
   */
  source?: RenderMaterialSource;

  /** Specifies the transparency of the material from 0.0 (fully transparent) to 1.0 (fully opaque).
   * If defined, this overrides the transparency of any surface to which the material is applied, and is multiplied with the
   * transparency of the material's [[textureMapping]] when sampling the texture.
   */
  alpha?: number;

  /** The [diffuse](https://en.wikipedia.org/wiki/Diffuse_reflection) properties of the material. */
  diffuse?: MaterialDiffuseProps;

  /** The [specular](https://en.wikipedia.org/wiki/Specular_highlight) properties of the material. */
  specular?: MaterialSpecularProps;

  /** Maps a [RenderTexture]($common) image to the surfaces to which the material is applied. */
  textureMapping?: MaterialTextureMappingProps;
}
