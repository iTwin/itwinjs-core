/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WireFormats */

/**
 * Metadata about a thumbnail. Often this is redundant with information in the image itself, but is held
 * outside of the image so it can be obtained without having to decode the image data.
 */
export interface ThumbnailFormatProps {
  /** X size of the image, in pixels. */
  width: number;
  /** Y size of image, in pixels. */
  height: number;
  /** Format of the image */
  format: "jpeg" | "png";
}

/** Properties of a thumbnail in an iModel. */
export interface ThumbnailProps extends ThumbnailFormatProps {
  /** Image data */
  image: Uint8Array;
}
