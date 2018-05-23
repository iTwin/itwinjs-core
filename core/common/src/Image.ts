/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Views */

/** format of an image buffer */
export const enum ImageBufferFormat { Rgba = 0, Rgb = 2, Alpha = 5 }

/** Uncompressed bitmap image data */
export class ImageBuffer {
  public readonly data: Uint8Array;
  public readonly format: ImageBufferFormat;
  public readonly width: number;

  public get numBytesPerPixel(): number { return ImageBuffer.getNumBytesPerPixel(this.format); }

  public static getNumBytesPerPixel(format: ImageBufferFormat): number {
    switch (format) {
      case ImageBufferFormat.Alpha: return 1;
      case ImageBufferFormat.Rgb: return 3;
      default: return 4;
    }
  }

  public get height(): number { return ImageBuffer.computeHeight(this.data, this.format, this.width); }

  public static create(data: Uint8Array, format: ImageBufferFormat, width: number): ImageBuffer | undefined {
    return this.isValidData(data, format, width) ? new ImageBuffer(data, format, width) : undefined;
  }

  protected static isValidData(data: Uint8Array, format: ImageBufferFormat, width: number): boolean {
    const height = this.computeHeight(data, format, width);
    return width > 0 && height > 0 && Math.floor(width) === width && Math.floor(height) === height;
  }

  protected static computeHeight(data: Uint8Array, format: ImageBufferFormat, width: number): number {
    return data.length / (width * this.getNumBytesPerPixel(format));
  }

  protected constructor(data: Uint8Array, format: ImageBufferFormat, width: number) {
    this.data = data;
    this.format = format;
    this.width = width;
  }
}

/** Returns whether the input is a power of two */
export function isPowerOfTwo(num: number): boolean { return 0 === (num & (num - 1)); }

/** Returns the first power-of-two value greater than or equal to the input */
export function nextHighestPowerOfTwo(num: number): number {
  --num;
  for (let i = 1; i < 32; i <<= 1)
    num = num | num >> i;

  return num + 1;
}

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
