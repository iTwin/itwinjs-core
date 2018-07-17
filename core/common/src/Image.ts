/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Rendering */

/** Format of an image buffer */
export const enum ImageBufferFormat { Rgba = 0, Rgb = 2, Alpha = 5 }

/** Uncompressed bitmap image data */
export class ImageBuffer {
  /** Image data */
  public readonly data: Uint8Array;
  /** Format of the bytes in the image. */
  public readonly format: ImageBufferFormat;
  /** Width of image in pixels */
  public readonly width: number;

  public get numBytesPerPixel(): number { return ImageBuffer.getNumBytesPerPixel(this.format); }

  public static getNumBytesPerPixel(format: ImageBufferFormat): number {
    switch (format) {
      case ImageBufferFormat.Alpha: return 1;
      case ImageBufferFormat.Rgb: return 3;
      default: return 4;
    }
  }

  /** Get the height of this image in pixels. */
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

/** The format of an ImageSource. Values must be consistent with data inside an iModel. */
export const enum ImageSourceFormat {
  /** Image data is stored with JPEG compression. */
  Jpeg = 0,
  /** Image data is stored with PNG compression. Value of 2 is a historical artifact and cannot be changed. */
  Png = 2,
}

/** Image data encoded and compressed in either Jpeg or Png format. */
export class ImageSource {
  /** The content of the image, compressed */
  public readonly data: Uint8Array;
  /** The compression type. */
  public readonly format: ImageSourceFormat;

  public constructor(data: Uint8Array, format: ImageSourceFormat) {
    this.data = data;
    this.format = format;
  }
}
