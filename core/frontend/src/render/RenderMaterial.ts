/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64String } from "@itwin/core-bentley";
import { ColorDef, RenderTexture, RgbColorProps, TextureMapping } from "@itwin/core-common";
import { IModelConnection } from "../IModelConnection";

/** Specifies the provenance of a [RenderMaterial]($common) created for a persistent material element.
 * @see [[CreateRenderMaterialArgs.source]].
 * @internal
 */
export interface RenderMaterialSource {
  iModel: IModelConnection;
  id: Id64String;
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

  /** The diffuse properties of the material. */
  diffuse?: {
    /** The diffuse color. If defined, this overrides the color of any surface to which the material is applied. */
    color?: ColorDef | RgbColorProps;

    /** A multiplier in [0..1] specifying how strongly the diffuse color reflects light. */
    weight?: number;
  };

  /** The [specular](https://en.wikipedia.org/wiki/Specular_highlight) properties of the material. */
  specular?: {
    /** The color of the specular reflections. Default: white. */
    color?: ColorDef | RgbColorProps;

    /** A multiplier in [0..1] specifying the strength of the specular reflections. */
    weight?: number;

    /** An exponent in [0..infinity] describing the shininess of the surface. */
    exponent?: number;
  };

  /** Maps a [RenderTexture]($common) image to the surfaces to which the material is applied. */
  textureMapping?: {
    /** The texture from which the image is obtained. */
    texture: RenderTexture;

    /** Describes how the texture image is mapped to the surface. Default: [TextureMapping.Mode.Parametric]($common). */
    mode?: TextureMapping.Mode;

    /** A 2x3 matrix for computing the UV coordinates. Default: [TextureMapping.Trans2x3.identity]($common). */
    transform?: TextureMapping.Trans2x3;

    /** The ratio by which the color sampled from the texture image is mixed with the surface's or material's diffuse color.
     * A ratio of 1 selects only the texture sample; a ratio of 0 selects only the diffuse color; a ratio of 0.5 mixes them evenly.
     * Default: 1.
     */
    weight?: number;

    /** @internal */
    worldMapping?: boolean;
  };
}
