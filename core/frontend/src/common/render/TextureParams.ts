/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Gradient, ImageBuffer, TextureTransparency } from "@itwin/core-common";

/** An object from which a [RenderTexture]($common) can be created.
 * @see [[TextureImage.source]]
 * @public
 * @extensions
 */
export type TextureImageSource = HTMLImageElement | ImageBuffer | ImageBitmap; // ###TODO | HTMLCanvasElement etc

/** Describes the image from which to create a [RenderTexture]($common).
 * @see [[CreateTextureArgs.image]]
 * @public
 * @extensions
 */
export interface TextureImage {
  /** The object that supplies the texture image. */
  source: TextureImageSource;
  /** Describes the transparency of the image. If this information can be supplied, it can improve performance.
   * If this information is not available at the call site, omit it - it defaults to "mixed" if it cannot be inferred from the source.
   */
  transparency?: TextureTransparency;
}

/** A key that uniquely identifies a [RenderTexture]($common) in the context of an [[IModelConnection]], used for caching.
 * @see [[TextureCacheOwnership]].
 * @public
 * @extensions
 */
export type TextureCacheKey = string | Gradient.Symb;
