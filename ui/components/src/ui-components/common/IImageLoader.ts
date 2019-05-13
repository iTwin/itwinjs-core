/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Common */

/**
 * Type of loaded image source:
 * * "svg" will render svg strings inline with the rest of the DOM
 * * "url" will render a simple img tag with __url__ as it's source
 * * "binary" expects a HEX string for the value and will render raw image
 * * "core-icon" will render an icon bundled with @bentley/ui-core
 * @public
 */
export type ImageSourceType = "svg" | "url" | "binary" | "core-icon";

/** Type of raw image format
 * @public
 */
export type ImageFileFormat = "png" | "jpg" | "jpge";

/** Image data for string based images
 * @public
 */
export interface LoadedImage {
  value: string;
  sourceType: ImageSourceType;
}

/** Image data for raw images
 * @public
 */
export interface LoadedBinaryImage extends LoadedImage {
  fileFormat: ImageFileFormat;
}

/** Image data returned by an [[IImageLoader]]
 * @public
 */
export type Image = LoadedImage | LoadedBinaryImage;

/** Interface for an image loader.
 * @public
 */
export interface IImageLoader {
  /** Function that will load image data */
  load: (item: any) => Image | undefined;
}
