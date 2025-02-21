/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Images
 */

import { BinaryImageSource, ImageBuffer, ImageBufferFormat, ImageSourceFormat } from "@itwin/core-common";
import { IModelNative } from "./internal/NativePlatform";

/** Arguments supplied to [[imageBufferFromImageSource]].
 * @public
 */
export interface ImageBufferFromImageSourceArgs {
  /** The encoded image to be decoded into an [ImageBuffer]($common). */
  source: BinaryImageSource;
  /** The desired format for the decoded [ImageBuffer]($common).
   * If unspecified, it defaults to [ImageBufferFormat.Rgb]($common) unless an alpha channel is present in [[source]].
   */
  targetFormat?: ImageBufferFormat.Rgb | ImageBufferFormat.Rgba;
}

/** Decode a [BinaryImageSource]($common) into an [ImageBuffer]($common).
 * Returns `undefined` if decoding fails, typically because the input was invalid.
 * @see [[imageSourceFromImageBuffer]] for the inverse conversion.
 * @public
 */
export function imageBufferFromImageSource(args: ImageBufferFromImageSourceArgs): ImageBuffer | undefined {
  const ret = IModelNative.platform.imageBufferFromImageSource(
    args.source.format,
    args.source.data,
    args.targetFormat ?? 255,
    false
  );

  if (!ret) {
    return undefined;
  }

  return ImageBuffer.create(ret.data, ret.format, ret.width);
}

/** Arguments supplied to [[imageSourceFromImageBuffer]].
 * @public
 */
export interface ImageSourceFromImageBufferArgs {
  /** The image to be encoded.
   * The image must be in [ImageBufferFormat.Rgb]($common) or [ImageBufferFormat.Rgba]($common) - [ImageBufferFormat.Alpha]($common) cannot be converted to an [ImageSource]($common).
   */
  image: ImageBuffer;
  /** The desired encoding for the resultant [BinaryImageSource]($common).
   * Defaults to [ImageSourceFormat.Jpeg]($common) unless an alpha channel is present in [[image]].
   */
  targetFormat?: ImageSourceFormat.Png | ImageSourceFormat.Jpeg;
  /** If true, invert the order of the rows of the encoded image. */
  flipVertically?: boolean;
  /** If [[targetFormat]] is (or defaults to) [ImageSourceFormat.Jpeg]($common), an integer between 0 and 100 indicating
   * the desired trade-off between image compression and image fidelity. This is a scale where 0 sacrifices image quality
   * in favor of minimizing the size of the encoded image, and 100 minimizes compression artifacts at the expense of size.
   * Default: 100.
   */
  jpegQuality?: number;
}

/** Encode an [ImageBuffer]($common) into a [BinaryImageSource]($common).
 * Returns `undefined` if encoding fails, typically because the input was invalid.
 * @throws Error if the ImageBuffer is of [ImageBufferFormat.Alpha]($common).
 * @public
 */
export function imageSourceFromImageBuffer(args: ImageSourceFromImageBufferArgs): BinaryImageSource | undefined {
  if (args.image.format === ImageBufferFormat.Alpha) {
    throw new Error("imageSourceFromImageBuffer cannot be used with alpha-only images");
  }

  return IModelNative.platform.imageSourceFromImageBuffer(
    args.image.format,
    args.image.data,
    args.image.width,
    args.image.height,
    args.targetFormat ?? 255,
    args.flipVertically ?? false,
    args.jpegQuality ?? 100
  );
}
