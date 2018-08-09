/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WireFormats */

import { ImageSourceFormat } from "./Image";

/**
 * Metadata about a thumbnail. Often this is redundant with information in the image itself, but is held
 * outside of the image so it can be obtained without having to decode the image data.
 */
export interface ThumbnailFormatProps {
  /** x size of the image */
  width: number;
  /** y size of image */
  height: number;
  /** format of the image */
  format: ImageSourceFormat;
}

/** Properties of a thumbnail in an iModel. */
export interface ThumbnailProps extends ThumbnailFormatProps {
  /** image data */
  image: Uint8Array;
}
