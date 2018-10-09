/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Rendering */

/** Format of an [[ImageBuffer]].
 * The format determines how many bytes are allocated for each pixel in the buffer and the semantics of each byte.
 * @see [[ImageBuffer.getNumBytesPerPixel]]
 */
export const enum ImageBufferFormat {
  /** RGBA format - 4 bytes per pixel. */
  Rgba = 0,
  /** RGB format - 3 bytes per pixel. */
  Rgb = 2,
  /** 1 byte per pixel. */
  Alpha = 5,
}

/** Uncompressed bitmap image data */
export class ImageBuffer {
  /** Image data in which each pixel occupies 1 or more bytes depending of the [[ImageBufferFormat]]. */
  public readonly data: Uint8Array;
  /** Format of the bytes in the image. */
  public readonly format: ImageBufferFormat;
  /** Width of image in pixels */
  public readonly width: number;

  /** Return the number of bytes allocated for each pixel. */
  public get numBytesPerPixel(): number { return ImageBuffer.getNumBytesPerPixel(this.format); }

  /** Determine the number of bytes allocated to a single pixel for the specified format. */
  public static getNumBytesPerPixel(format: ImageBufferFormat): number {
    switch (format) {
      case ImageBufferFormat.Alpha: return 1;
      case ImageBufferFormat.Rgb: return 3;
      default: return 4;
    }
  }

  /** Get the height of this image in pixels. */
  public get height(): number { return ImageBuffer.computeHeight(this.data, this.format, this.width); }

  /** Create a new ImageBuffer.
   * @note The ImageBuffer takes ownership of the input Uint8Array.
   * @param data The uncompressed image bytes. Must be a multiple of the width times the number of bytes per pixel specified by the format.
   * @param format The format of the image.
   * @param width The width of the image in pixels.
   * @returns A new ImageBuffer, or undefined if the length of the Uint8Array is not appropriate for the specified width and format.
   */
  public static create(data: Uint8Array, format: ImageBufferFormat, width: number): ImageBuffer | undefined {
    return this.isValidData(data, format, width) ? new ImageBuffer(data, format, width) : undefined;
  }

  /** @hidden */
  protected static isValidData(data: Uint8Array, format: ImageBufferFormat, width: number): boolean {
    const height = this.computeHeight(data, format, width);
    return width > 0 && height > 0 && Math.floor(width) === width && Math.floor(height) === height;
  }

  /** @hidden */
  protected static computeHeight(data: Uint8Array, format: ImageBufferFormat, width: number): number {
    return data.length / (width * this.getNumBytesPerPixel(format));
  }

  /** @hidden */
  protected constructor(data: Uint8Array, format: ImageBufferFormat, width: number) {
    this.data = data;
    this.format = format;
    this.width = width;
  }
}

/** Returns whether the input is a power of two.
 * @note Floating point inputs are truncated.
 */
export function isPowerOfTwo(num: number): boolean { return 0 === (num & (num - 1)); }

/** Returns the first power-of-two value greater than or equal to the input.
 * @note Floating point inputs are truncated.
 */
export function nextHighestPowerOfTwo(num: number): number {
  --num;
  for (let i = 1; i < 32; i <<= 1)
    num = num | num >> i;

  return num + 1;
}

/** The format of an ImageSource. */
export const enum ImageSourceFormat {
  /** Image data is stored with JPEG compression. */
  Jpeg = 0,
  /** Image data is stored with PNG compression. */
  Png = 2,
}

/** @hidden */
export function isValidImageSourceFormat(format: ImageSourceFormat): boolean {
  switch (format) {
    case ImageSourceFormat.Jpeg:
    case ImageSourceFormat.Png:
      return true;
    default:
      return false;
  }
}

/** Image data encoded and compressed in either Jpeg or Png format. */
export class ImageSource {
  /** The content of the image, compressed */
  public readonly data: Uint8Array;
  /** The compression type. */
  public readonly format: ImageSourceFormat;

  /** Construct a new ImageSource, which takes ownership of the Uint8Array. */
  public constructor(data: Uint8Array, format: ImageSourceFormat) {
    this.data = data;
    this.format = format;
  }
}
