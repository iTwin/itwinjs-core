/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { ImageSource, ImageSourceFormat } from "@bentley/imodeljs-common";
import { Point2d } from "@bentley/geometry-core";

/** Utilities for handling image data. */
export class ImageUtil {
  /** Get a string describing the mime type associated with an ImageSource format. */
  public static getImageSourceMimeType(format: ImageSourceFormat): string { return ImageSourceFormat.Jpeg === format ? "image/jpeg" : "image/png"; }

  /** Get the ImageSourceFormat corresponding to the mime type string, or undefined if the string does not identify a supported ImageSourceFormat. */
  public static getImageSourceFormatForMimeType(mimeType: string): ImageSourceFormat | undefined {
    switch (mimeType) {
      case "image/jpeg": return ImageSourceFormat.Jpeg;
      case "image/png": return ImageSourceFormat.Png;
      default: return undefined;
    }
  }

  /**
   * Extract an html Image element from a binary jpeg or png.
   * @param source The ImageSource containing the binary jpeg or png data.
   * @returns a Promise which resolves to an HTMLImageElement containing the uncompressed bitmap image in RGBA format.
   */
  public static async extractImage(source: ImageSource): Promise<HTMLImageElement> {
    const blob = new Blob([source.data], { type: this.getImageSourceMimeType(source.format) });
    return this.fromUrl(URL.createObjectURL(blob));
  }

  public static async fromUrl(url: string): Promise<HTMLImageElement> {
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
   */
  public static async extractImageDimensions(source: ImageSource): Promise<Point2d> {
    return this.extractImage(source).then((image) => new Point2d(image.naturalWidth, image.naturalHeight));
  }
}
