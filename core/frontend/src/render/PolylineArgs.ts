/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { ColorIndex, FeatureIndex, LinePixels, PolylineFlags, PolylineIndices, QPoint3dList } from "@itwin/core-common";
import { Point3d, Range3d } from "@itwin/core-geometry";

/** Arguments supplied to [[RenderSystem.createIndexedPolylines]] describing a set of "polylines" (i.e., line strings or point strings).
 * Line strings consist of two or more points, connected by segments between them with a width specified in pixels.
 * Point strings consist of one or more disconnected points, drawn as dots with a radius specified in pixels.
 * @public
 */
export interface PolylineArgs {
  /** The color(s) of the vertices. */
  colors: ColorIndex;
  /** The [Feature]($common)(s) contained in the [[polylines]]. */
  features: FeatureIndex;
  /** The width of the lines or radius of the points, in pixels. */
  width: number;
  /** The pixel pattern to apply to the line strings. */
  linePixels: LinePixels;
  /** Flags describing how to draw the [[polylines]]. */
  flags: PolylineFlags;
  /** The positions of the [[polylines]]' vertices. If the positions are not quantized, they must include
   * a precomputed [Range3d]($core-geometry) encompassing all of the points.
   */
  points: QPoint3dList | (Array<Point3d> & { range: Range3d });
  /** The set of polylines. Each entry in the array describes a separate line string or point string as a series of indices into [[points]]. */
  polylines: PolylineIndices[];
}

