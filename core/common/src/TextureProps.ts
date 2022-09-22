/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Entities
 */

import { Id64String } from "@itwin/core-bentley";
import { DefinitionElementProps } from "./ElementProps";
import { ImageSourceFormat } from "./Image";
import { Base64EncodedString } from "./Base64EncodedString";

/** Properties that define a [Texture]($backend) element.
 * @public
 * @extensions
 */
export interface TextureProps extends DefinitionElementProps {
  /** Format of the image data. */
  format: ImageSourceFormat;
  /** The image data stored in a Base64-encoded string according to the specified format.
   * @see [[Base64EncodedString.fromUint8Array]] to produce a well-formed base-64-encoded string.
   * @see [[Base64EncodedString.toUint8Array]] to decode the bytes.
   */
  data: Base64EncodedString;
  /** An optional description of the texture. */
  description?: string;
}

/** Properties that specify what texture should be loaded and how it should be loaded.
 * @public
 * @extensions
 */
export interface TextureLoadProps {
  /** A valid Id64 string identifying the texture */
  name: Id64String;
  /** Maximum texture size supported by the client. If specified, the texture will be downsampled so both of its dimensions adhere to this size. */
  maxTextureSize?: number;
}

/** Describes the type of transparency in the pixels of a [TextureImage]($frontend).
 * Each pixel can be classified as either opaque or translucent.
 * The transparency of the image as a whole is based on the combination of pixel transparencies.
 * If this information is known, it should be supplied when creating a texture for more efficient rendering.
 * @see [TextureImage.transparency]($frontend).
 * @public
 */
export enum TextureTransparency {
  /** The image contains only opaque pixels. It should not blend with other objects in the scene. */
  Opaque,
  /** The image contains only translucent pixels. It should blend with other objects in the scene. */
  Translucent,
  /** The image contains both opaque and translucent pixels. The translucent pixels should blend with other objects in the scene, while
   * the opaque pixels should not. Rendering this type of transparency is somewhat more expensive.
   */
  Mixed,
}

/** Information about [Texture]($backend) data returned by [[IModelReadRpcInterface.queryTextureData]].
 * @public
 * @extensions
 */
export interface TextureData {
  /** The width of the image, possibly reduced from the original width based on [[TextureLoadProps.maxTextureSize]]. */
  width: number;
  /** The height of the image, possibly reduced from the original height based on [[TextureLoadProps.maxTextureSize]]. */
  height: number;
  /** The format of the image (Jpeg or Png). */
  format: ImageSourceFormat;
  /** The encoded image bytes. */
  bytes: Uint8Array;
  /** Information about the transparency of the texture image. Default: [[TextureTransparency.Mixed]]. */
  transparency?: TextureTransparency;
}
