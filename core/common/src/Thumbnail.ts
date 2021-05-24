/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

/** Metadata about a thumbnail image. Often this is redundant with information in the image itself, but is held
 * outside of the image so it can be obtained without having to decode the image data.
 * @see [[ThumbnailProps]]
 * @public
 */
export interface ThumbnailFormatProps {
  /** X size of the image, in pixels. */
  width: number;
  /** Y size of image, in pixels. */
  height: number;
  /** Encoding of the image */
  format: "jpeg" | "png";
}

/** Describes a thumbnail image for an [[IModel]] or [ViewDefinition]($backend).
 * @see [IModelDb.getThumbnail]($backend) or [IModelConnection.getThumbnail]($frontend) to obtain a thumbnail for a view.
 * @see [IModelDb.saveThumbnail]($backend) or [IModelConnection.saveThumbnail]($frontend) to save a thumbnail for a view.
 * @public
 */
export interface ThumbnailProps extends ThumbnailFormatProps {
  /** The image encoded as specified by [[ThumbnailFormatProps.format]]. */
  image: Uint8Array;
}
