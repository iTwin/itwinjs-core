/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { ProcessDetector } from "@itwin/core-bentley";
import { Point2d } from "@itwin/core-geometry";
import { ImageBuffer, ImageBufferFormat, ImageSource, ImageSourceFormat } from "@itwin/core-common";
import { ViewRect } from "./ViewRect";

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

/** Resize a canvas to a desired size.  The final size will be targetSize plus barSize.  The original canvas is left untouched and a new, resized canvas with potential side bars is returned.
 * @param canvasIn the source [HTMLCanvasElement](https://developer.mozilla.org/docs/Web/API/HTMLCanvasElement) to resize.
 * @param targetSize the desired new size for the canvas image.
 * @param barSize total size of side bars to add to the image in width and height; defaults to (0, 0).  For example, if you specify (2, 0), a 1 pixel side bar will be added to the left and right sides of the resized image.  If an odd dimension is specified, the left or upper side of the image will be one pixel larger than the opposite side.  For example, if you specify (1, 0), a 1 pixel side bar will be added to the left side of the image and a 0 pixel side bar will be added to the right side of the image.
 * @param barStyle CSS style string to apply to any side bars; defaults to "#C0C0C0", which is silver.
 * @returns an [HTMLCanvasElement](https://developer.mozilla.org/docs/Web/API/HTMLCanvasElement) object containing the resized image and any requested side bars.
 * @public
 */
export function canvasToResizedCanvasWithBars(canvasIn: HTMLCanvasElement, targetSize: Point2d, barSize = new Point2d(0, 0), barStyle = "#C0C0C0"): HTMLCanvasElement {
  const canvasOut = document.createElement("canvas");
  canvasOut.width = targetSize.x + barSize.x;
  canvasOut.height = targetSize.y + barSize.y;

  let adjustImageX = barSize.x / 2;
  let adjustImageY = barSize.y / 2;

  if (1 === barSize.x % 2) {
    adjustImageX += 0.5;
  }
  if (1 === barSize.y % 2) {
    adjustImageY += 0.5;
  }

  const context = canvasOut.getContext("2d")!;
  context.fillStyle = barStyle;
  context.fillRect(0, 0, canvasOut.width, canvasOut.height);
  context.drawImage(canvasIn, adjustImageX, adjustImageY, targetSize.x, targetSize.y);
  return canvasOut;
}

/** Create a canvas element with the same dimensions and contents as an image buffer.
 * @param buffer the source [[ImageBuffer]] object from which the [HTMLCanvasElement](https://developer.mozilla.org/docs/Web/API/HTMLCanvasElement) object will be constructed.
 * @param preserveAlpha If false, the alpha channel will be set to 255 (fully opaque). This is recommended when converting an already-blended image (e.g., one obtained from [[Viewport.readImage]]).
 * @returns an [HTMLCanvasElement](https://developer.mozilla.org/docs/Web/API/HTMLCanvasElement) object containing the contents of the source image buffer, or undefined if the conversion fails.
 * @public
 */
export function imageBufferToCanvas(buffer: ImageBuffer, preserveAlpha: boolean = true): HTMLCanvasElement | undefined {
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
    imageData.data[j + 3] = preserveAlpha ? rgba.a : 0xff;
    j += 4;
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}

/** Create an ImageBuffer in the specified format with the same dimensions and contents as a canvas.
 * @param canvas the source [HTMLCanvasElement](https://developer.mozilla.org/docs/Web/API/HTMLCanvasElement) object from which the [[ImageBuffer]] object will be constructed.
 * @param format the desired format of the created ImageBuffer; defaults to [[ImageBufferFormat.Rgba]].
 * @returns an [[ImageBuffer]] object containing the contents of the source canvas, or undefined if the conversion fails.
 * @public
 */
export function canvasToImageBuffer(canvas: HTMLCanvasElement, format = ImageBufferFormat.Rgba): ImageBuffer | undefined {
  const context = canvas.getContext("2d");
  if (null === context)
    return undefined;

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

  let imageBufferData: Uint8Array | undefined;

  if (ImageBufferFormat.Rgba === format) {
    imageBufferData = new Uint8Array(imageData.data.length);
  } else if (ImageBufferFormat.Rgb === format) {
    imageBufferData = new Uint8Array((imageData.data.length / 4) * 3);
  } else if (ImageBufferFormat.Alpha === format) {
    imageBufferData = new Uint8Array(imageData.data.length / 4);
  }

  if (undefined === imageBufferData)
    return undefined;

  let i = 0;
  let j = 0;
  while (i < imageData.data.length) {
    if (ImageBufferFormat.Rgba === format) {
      imageBufferData[j + 0] = imageData.data[i + 0];
      imageBufferData[j + 1] = imageData.data[i + 1];
      imageBufferData[j + 2] = imageData.data[i + 2];
      imageBufferData[j + 3] = imageData.data[i + 3];
      j += 4;
    } else if (ImageBufferFormat.Rgb === format) {
      imageBufferData[j + 0] = imageData.data[i + 0];
      imageBufferData[j + 1] = imageData.data[i + 1];
      imageBufferData[j + 2] = imageData.data[i + 2];
      j += 3;
    } else if (ImageBufferFormat.Alpha === format) {
      imageBufferData[j] = imageData.data[i + 3];
      j++;
    }
    i += 4;
  }

  return ImageBuffer.create(imageBufferData, format, canvas.width);
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
 * @see tryImageElementFromUrl.
 * @public
 */
export async function imageElementFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve: (image: HTMLImageElement) => void, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);

    // The "error" produced by Image is not an Error. It looks like an Event, but isn't one.
    image.onerror = () => reject(new Error("Failed to create image from url"));
    image.src = url;
  });
}

/** Try to create an html Image element from a URL.
 * @param url The URL pointing to the image data.
 * @returns A Promise resolving to an HTMLImageElement when the image data has been loaded from the URL, or to `undefined` if an exception occurred.
 * @see imageElementFromUrl
 * @public
 */
export async function tryImageElementFromUrl(url: string): Promise<HTMLImageElement | undefined> {
  try {
    return await imageElementFromUrl(url);
  } catch {
    return undefined;
  }
}
/**
 * Extract the dimensions of the jpeg or png data encoded in an ImageSource.
 * @param source The ImageSource containing the binary jpeg or png data.
 * @returns a Promise resolving to a Point2d of which x corresponds to the integer width of the uncompressed bitmap and y to the height.
 * @public
 */
export async function extractImageSourceDimensions(source: ImageSource): Promise<Point2d> {
  const image = await imageElementFromImageSource(source);
  return new Point2d(image.naturalWidth, image.naturalHeight);
}

/**
 * Produces a data url in "image/png" format from the contents of an ImageBuffer.
 * @param buffer The ImageBuffer, of any format.
 * @param preserveAlpha If false, the alpha channel will be set to 255 (fully opaque). This is recommended when converting an already-blended image (e.g., one obtained from [[Viewport.readImage]]).
 * @returns a data url as a string suitable for setting as the `src` property of an HTMLImageElement, or undefined if the url could not be created.
 * @public
 */
export function imageBufferToPngDataUrl(buffer: ImageBuffer, preserveAlpha = true): string | undefined {
  // The default format (and the only format required to be supported) for toDataUrl() is "image/png".
  const canvas = imageBufferToCanvas(buffer, preserveAlpha);
  return undefined !== canvas ? canvas.toDataURL() : undefined;
}

/**
 * Converts the contents of an ImageBuffer to PNG format.
 * @param buffer The ImageBuffer, of any format.
 * @param preserveAlpha If false, the alpha channel will be set to 255 (fully opaque). This is recommended when converting an already-blended image (e.g., one obtained from [[Viewport.readImage]]).
 * @returns a base64-encoded string representing the image as a PNG, or undefined if the conversion failed.
 * @public
 */
export function imageBufferToBase64EncodedPng(buffer: ImageBuffer, preserveAlpha = true): string | undefined {
  const urlPrefix = "data:image/png;base64,";
  const url = imageBufferToPngDataUrl(buffer, preserveAlpha);
  if (undefined === url || !url.startsWith(urlPrefix))
    return undefined;

  return url.substring(urlPrefix.length);
}

/** Open an image specified as a data URL in a new window or tab. Works around differences between browsers and Electron.
 * @param url The base64-encoded image URL.
 * @param title An optional title to apply to the new window.
 * @beta
 */
export function openImageDataUrlInNewWindow(url: string, title?: string): void {
  if (ProcessDetector.isElectronAppFrontend) {
    window.open(url, title);
  } else {
    const win = window.open();
    if (null === win)
      return;

    const div = win.document.createElement("div");
    div.innerHTML = `<img src='${url}'/>`;
    win.document.body.append(div);
    if (undefined !== title)
      win.document.title = title;
  }
}

/** Determine the maximum [[ViewRect]] that can be fitted and centered in specified ViewRect given a required aspect ratio.
 * @param viewRect The rectangle in which the returned rectangle is to be centered and fitted.
 * @param aspectRatio Ratio of width to height.
 * @returns A ViewRect centered in the input rectangle.
 * @public
 */
export function getCenteredViewRect(viewRect: ViewRect, aspectRatio = 1.4): ViewRect {
  // Determine scale that ensures ability to return an image with the prescribed aspectRatio
  const scale = Math.min(viewRect.width / aspectRatio, viewRect.height);
  const finalWidth = scale * aspectRatio;
  const finalHeight = scale;
  const left = (viewRect.width - finalWidth) / 2.0;
  const right = left + finalWidth;
  const top = (viewRect.height - finalHeight) / 2.0;
  const bottom = top + finalHeight;
  return new ViewRect(left, top, right, bottom);
}

/** Produce a jpeg compressed to no more than specified bytes and of no less than specified quality.
 * @param canvas Canvas containing the image to be compressed.
 * @param maxBytes Maximum size of output jpeg in bytes.
 * @param minCompressionQuality The minimum acceptable image quality as a number between 0 (lowest quality) and 1 (highest quality).
 * @returns A [data URL](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs) for the image, or `undefined` if the compression and size constraints could not be met.
 * @public
 */
export function getCompressedJpegFromCanvas(canvas: HTMLCanvasElement, maxBytes = 60000, minCompressionQuality = 0.1): string | undefined {
  const decrements = 0.1; // Decrements of quality
  const bytesPerCharacter = 2; // Assume 16-bit per character
  let quality = 1.0; // JPEG Compression quality

  while (quality > minCompressionQuality) {
    const data = canvas.toDataURL("image/jpeg", quality);
    // If we are less than 60 Kb, we are good
    if (data.length * bytesPerCharacter < maxBytes)
      return data;

    quality -= decrements;
  }

  return undefined;
}
