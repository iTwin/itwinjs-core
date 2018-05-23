/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Views */

/** format of an image buffer */
export const enum ImageBufferFormat { Rgba = 0, Rgb = 2, Alpha = 5 }

/** format of an image */
export const enum ImageSourceFormat { Jpeg = 0, Png = 2 }

/** is image is stored bottom-up or top-up? This determines whether the rows should be flipped top-to-bottom */
export const enum BottomUp { No = 0, Yes = 1 }

/** Image data encoded as a jpeg or png */
export class ImageSource {
  public readonly data: Uint8Array;
  public readonly format: ImageSourceFormat;

  public constructor(data: Uint8Array, format: ImageSourceFormat) {
    this.data = data;
    this.format = format;
  }
}

export type TextureDimension = 2 | 4 | 8 | 16 | 32 | 64 | 128 | 256 | 512 | 1024 | 2048;

/** Image data encoded as an uncompressed bitmap in RGB or RGBA format. */
export class ImageBuffer {
  public readonly width: number;
  public readonly height: number;
  public readonly format: ImageBufferFormat;
  public readonly data: Uint8Array;

  public constructor(width: number, height: number, data: Uint8Array, format: ImageBufferFormat) {
    this.width = width;
    this.height = height;
    this.format = format;
    this.data = data;
  }
}
