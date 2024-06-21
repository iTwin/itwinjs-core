/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Images
 */

import { ImageBuffer, ImageBufferFormat, ImageSourceFormat } from "@itwin/core-common";
import { IModelHost } from "./IModelHost";

export type BinaryImageSourceFormat = ImageSourceFormat.Jpeg | ImageSourceFormat.Png;

export interface BinaryImageSource {
  data: Uint8Array;
  format: BinaryImageSourceFormat;
}

export interface ImageBufferToBinaryImageSourceArgs {
  imageBuffer: ImageBuffer;
  targetFormat: BinaryImageSourceFormat;
  jpegQuality?: number;
  flipVertically?: boolean;
} 

export interface BinaryImageSourceToImageBufferArgs {
  imageSource: BinaryImageSource;
  targetFormat: ImageBufferFormat;
  flipVertically?: boolean;
}

export function imageBufferToBinaryImageSource(_args: ImageBufferToBinaryImageSourceArgs): BinaryImageSource | undefined {
  return undefined; // ###TODO
}

export function binaryImageSourceToImageBuffer(_args: BinaryImageSourceToImageBufferArgs): ImageBuffer | undefined {
  return undefined; // ###TODO
}
