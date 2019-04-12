/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { ImageSource, ImageSourceFormat, ImageBuffer, ImageBufferFormat } from "@bentley/imodeljs-common";
import { Point2d } from "@bentley/geometry-core";

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const scratchRgba = { r: 0, g: 0, b: 0, a: 0 };

function rgbaFromAlpha(rgba: Rgba, src: Uint8Array, idx: number): number {
  rgba.r = rgba.g = rgba.b = rgba.a = src[idx];
  return idx + 1;
}

function rgbaFromRgb(rgba: Rgba, src: Uint8Array, idx: number): number {
  rgba.r = src[idx + 0];
  rgba.g = src[idx + 1];
  rgba.b = src[idx + 2];
  rgba.a = 255;
  return idx + 3;
}

function rgbaFromRgba(rgba: Rgba, src: Uint8Array, idx: number): number {
  rgbaFromRgb(rgba, src, idx);
  rgba.a = src[idx + 3];
  return idx + 4;
}

/** Creates a canvas element with the same dimensions and contents as the ImageBuffer. */
function imageBufferToCanvas(buffer: ImageBuffer): HTMLCanvasElement | undefined {
  const canvas = document.createElement("canvas");
  if (null === canvas)
    return undefined;

  canvas.width = buffer.width;
  canvas.height = buffer.height;

  const context = canvas.getContext("2d");
  if (null === context)
    return undefined;

  const imageData = context.createImageData(buffer.width, buffer.height);
  const extractRgba = ImageBufferFormat.Alpha === buffer.format ? rgbaFromAlpha : (ImageBufferFormat.Rgb === buffer.format ? rgbaFromRgb : rgbaFromRgba);

  const bufferData = buffer.data;
  let i = 0;
  let j = 0;
  const rgba = scratchRgba;
  while (i < bufferData.length) {
    i = extractRgba(rgba, bufferData, i);
    imageData.data[j + 0] = rgba.r;
    imageData.data[j + 1] = rgba.g;
    imageData.data[j + 2] = rgba.b;
    imageData.data[j + 3] = rgba.a;
    j += 4;
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}

/** Get a string describing the mime type associated with an ImageSource format.
 * @public
 */
export function getImageSourceMimeType(format: ImageSourceFormat): string {

  switch (format) {
    case ImageSourceFormat.Jpeg:
      return "image/jpeg";
    case ImageSourceFormat.Png:
      return "image/png";
    case ImageSourceFormat.Svg:
      return "image/svg+xml;charset=utf-8";
  }
  return "";
}

/** Get the ImageSourceFormat corresponding to the mime type string, or undefined if the string does not identify a supported ImageSourceFormat.
 * @public
 */
export function getImageSourceFormatForMimeType(mimeType: string): ImageSourceFormat | undefined {
  switch (mimeType) {
    case "image/jpeg": return ImageSourceFormat.Jpeg;
    case "image/png": return ImageSourceFormat.Png;
    case "image/svg+xml;charset=utf-8": return ImageSourceFormat.Svg;
    default: return undefined;
  }
}

/** Extract an html Image element from a binary jpeg or png.
 * @param source The ImageSource containing the binary jpeg or png data.
 * @returns a Promise which resolves to an HTMLImageElement containing the uncompressed bitmap image in RGBA format.
 * @public
 */
export async function imageElementFromImageSource(source: ImageSource): Promise<HTMLImageElement> {
  const blob = new Blob([source.data], { type: getImageSourceMimeType(source.format) });
  return imageElementFromUrl(URL.createObjectURL(blob));
}

/** Create an html Image element from a URL.
 * @param url The URL pointing to the image data.
 * @returns A Promise resolving to an HTMLImageElement when the image data has been loaded from the URL.
 * @public
 */
export async function imageElementFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve: (image: HTMLImageElement) => void, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

/**
 * Extract the dimensions of the jpeg or png data encoded in an ImageSource.
 * @param source The ImageSource containing the binary jpeg or png data.
 * @returns a Promise resolving to a Point2d of which x corresponds to the integer width of the uncompressed bitmap and y to the height.
 * @public
 */
export async function extractImageSourceDimensions(source: ImageSource): Promise<Point2d> {
  return imageElementFromImageSource(source).then((image) => new Point2d(image.naturalWidth, image.naturalHeight));
}

/**
 * Produces a data url in "image/png" format from the contents of an ImageBuffer.
 * @param buffer The ImageBuffer, of any format.
 * @returns a data url as a string suitable for setting as the `src` property of an HTMLImageElement, or undefined if the url could not be created.
 * @public
 */
export function imageBufferToPngDataUrl(buffer: ImageBuffer): string | undefined {
  // The default format (and the only format required to be supported) for toDataUrl() is "image/png".
  const canvas = imageBufferToCanvas(buffer);
  return undefined !== canvas ? canvas.toDataURL() : undefined;
}

/**
 * Converts the contents of an ImageBuffer to PNG format.
 * @param buffer The ImageBuffer, of any format.
 * @returns a base64-encoded string representing the image as a PNG, or undefined if the conversion failed.
 * @public
 */
export function imageBufferToBase64EncodedPng(buffer: ImageBuffer): string | undefined {
  const urlPrefix = "data:image/png;base64,";
  const url = imageBufferToPngDataUrl(buffer);
  if (undefined === url || !url.startsWith(urlPrefix))
    return undefined;

  return url.substring(urlPrefix.length);
}
