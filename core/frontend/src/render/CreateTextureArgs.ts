/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { ImageSource, RenderTexture, TextureTransparency } from "@itwin/core-common";
import { IModelConnection } from "../IModelConnection";
import { TextureCacheKey, TextureImage } from "../common/render/TextureParams";

/** Specifies that a [RenderTexture]($common) should be kept in memory until the corresponding [[IModelConnection]] is closed, at
 * which point it will be disposed.
 * @see [[TextureOwnership]]
 * @public
 * @extensions
 */
export interface TextureCacheOwnership {
  /** The iModel on which the texture will be cached. */
  iModel: IModelConnection;
  /** The key uniquely identifying the texture amongst all textures cached on the iModel. */
  key: TextureCacheKey;
}

/** Describes the ownership of a [RenderTexture]($common), which controls when the texture is disposed of.
 * - [[TextureCacheOwnership]] indicates that the texture will be disposed of when the [[IModelConnection]] is closed, and that attempting
 * to create or look up a texture with the same `key` as an existing cached texture will always return the cached texture instead of creating
 * a new one.
 * - "external" indicates that the lifetime of the texture will be controlled externally, e.g. by a [[Decorator]], in which case the owner of the
 * texture is responsible for calling its `dispose` method when it is no longer needed.
 * @see [[CreateTextureArgs.ownership]]
 * @public
 * @extensions
 */
export type TextureOwnership = TextureCacheOwnership | "external";

/** Arguments supplied to [[RenderSystem.createTexture]] to create a [RenderTexture]($common).
 * @public
 * @extensions
 */
export interface CreateTextureArgs {
  /** The type of texture to create. Default: [RenderTexture.Type.Normal]($common). */
  type?: RenderTexture.Type;
  /** The image from which to create the texture. */
  image: TextureImage;
  /** The ownership of the texture. If `undefined`, the texture's lifetime will be controlled by the first [[RenderGraphic]] with which it
   * becomes associated, such that disposing of the graphic will also dispose of the texture.
   * Applications typically create textures for use with [[Decorator]]s, which recreate their graphics quite frequently.
   * Ideally, the decorator will take ownership of the texture by specifying "external" and disposing of the texture when it is no longer needed,
   * rather than recreating the texture every time it creates its decoration graphics.
   */
  ownership?: TextureOwnership;
}

/** Arguments supplied to [[RenderSystem.createTextureFromSource]].
 * @public
 * @extensions
 */
export interface CreateTextureFromSourceArgs {
  /** The type of texture to create. Default: [RenderTexture.Type.Normal]($common). */
  type?: RenderTexture.Type;
  /** The image from which to create the texture. */
  source: ImageSource;
  /** Describes the transparency of the image. If this information can be supplied, it can improve performance.
   * If not supplied, PNGs will default to [TextureTransparency.Mixed]($common) and JPEGs (which do not support transparency) to [TextureTransparency.Opaque]($common).
   */
  transparency?: TextureTransparency;
  /** The ownership of the texture. If `undefined`, the texture's lifetime will be controlled by the first [[RenderGraphic]] with which it
   * becomes associated, such that disposing of the graphic will also dispose of the texture.
   * Applications typically create textures for use with [[Decorator]]s, which recreate their graphics quite frequently.
   * Ideally, the decorator will take ownership of the texture by specifying "external" and disposing of the texture when it is no longer needed,
   * rather than recreating the texture every time it creates its decoration graphics.
   */
  ownership?: TextureCacheOwnership & { key: string } | "external";
}
