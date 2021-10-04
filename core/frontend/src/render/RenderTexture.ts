/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Gradient, ImageBuffer, RenderTexture } from "@itwin/core-common";
import { IModelConnection } from "../IModelConnection";

/** Describes the type of transparency in the pixels of a [[TextureImage]].
 * Each pixel can be classified as either 100% opaque, 100% transparent, or semi-transparent ("translucent").
 * The transparency of the image as a whole is based on the combination of pixel transparencies.
 * If this information is known, it should be supplied when creating a texture for more efficient rendering.
 * @see [[TextureImage.transparency]].
 * @beta
 */
export enum TextureTransparency {
  /** All pixels are either 100% opaque or 100% transparent. */
  Opaque,
  /** All pixels are fully or partially transparent - no opaque pixels are present. */
  Translucent,
  /** Both opaque and semi-transparent pixels are present. Rendering this type of transparency is somewhat more expensive. */
  Mixed,
  /** The default if transparency information is not available. */
  Unknown = Mixed,
}

/** A key that uniquely identifies a [RenderTexture]($common) in the context of an [[IModelConnection]], used for caching.
 * @see [[TextureCacheOwnership]].
 * @beta
 */
export type TextureCacheKey = string | Gradient.Symb;

/** Specifies that a [RenderTexture]($common) should be kept in memory until the corresponding [[IModelConnection]] is closed, at
 * which point it will be disposed.
 * @see [[TextureOwnership]]
 * @beta
 */
export interface TextureCacheOwnership {
  /** The iModel on which the texture will be cached. */
  iModel: IModelConnection;
  /** The key uniquely identifying the texture amongst all textures cached on the iModel. */
  key: string | Gradient.Symb;
}

/** Describes the ownership of a [RenderTexture]($common), which controls when the texture is disposed of.
 * - [[TextureCacheOwnership]] indicates that the texture will be disposed of when the [[IModelConnection]] is closed, and that attempting
 * to create or look up a texture with the same `key` as an existing cached texture will always return the cached texture instead of creating
 * a new one.
 * - "external" indicates that the lifetime of the texture will be controlled externally, e.g. by a [[Decorator]], in which case the owner of the
 * texture is responsible for calling its `dispose` method when it is no longer needed.
 * @see [[CreateTextureArgs.ownership]]
 * @beta
 */
export type TextureOwnership = TextureCacheOwnership | "external";

/** An object from which a [RenderTexture]($common) can be created.
 * @see [[TextureImage.source]]
 * @beta
 */
export type TextureImageSource = HTMLImageElement | ImageBuffer; // ###TODO | HTMLCanvasElement etc

/** Describes the image from which to create a [RenderTexture]($common).
 * @see [[CreateTextureArgs.image]]
 * @beta
 */
export interface TextureImage {
  /** The object that supplies the texture image. */
  source: TextureImageSource;
  /** Describes the transparency of the image. If this information can be supplied, it can improve performance.
   * If this information is not available at the call site, pass [[TextureTransparency.Unknown]].
   */
  transparency: TextureTransparency;
}

/** Arguments supplied to [[RenderSystem.createTexture]] to create a [RenderTexture]($common).
 * @beta
 */
export interface CreateTextureArgs {
  /** The type of texture to create. Default: [RenderTexture.Type.Normal]($common). */
  type?: RenderTexture.Type;
  /** The image from which to create the texture. */
  image: TextureImage;
  /** The ownership of the texture. If `undefined`, the texture will be disposed of by any [[RenderGraphic]] with which it is later associated. */
  ownership?: TextureOwnership;
}
