/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BinaryImageSource, ImageBuffer, ImageBufferFormat, ImageSourceFormat } from "@itwin/core-common";
import { IModelNative } from "./internal/NativePlatform";

export interface ImageBufferFromImageSourceArgs {
  source: BinaryImageSource;
  // If omitted, will be chosen based on presence of alpha channel in [[source]].
  targetFormat?: ImageBufferFormat.Rgb | ImageBufferFormat.Rgba;
  flipVertically?: boolean;
}

export function imageBufferFromImageSource(args: ImageBufferFromImageSourceArgs): ImageBuffer | undefined {
  const ret = IModelNative.platform.imageBufferFromImageSource(
    args.source.format,
    args.source.data,
    args.targetFormat ?? 255,
    args.flipVertically ?? false
  );

  if (!ret) {
    return undefined;
  }

  return ImageBuffer.create(ret.data, ret.format, ret.width);
}

export interface ImageSourceFromImageBufferArgs {
  image: Pick<ImageBuffer, "data" | "width" | "height"> & { format: ImageBufferFormat.Rgba | ImageBufferFormat.Rgb },
  // Default PNG
  targetFormat?: ImageSourceFormat.Png | ImageSourceFormat.Jpeg,
  flipVertically?: boolean,
  // Default 100, ignored if not Jpeg
  jpegQuality?: number,
}

export function imageSourceFromImageBuffer(args: ImageSourceFromImageBufferArgs): BinaryImageSource | undefined {
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
