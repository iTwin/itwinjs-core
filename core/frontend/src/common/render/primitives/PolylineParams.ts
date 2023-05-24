/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { LinePixels, PolylineTypeFlags } from "@itwin/core-common";
import { VertexIndices } from "./VertexIndices";
import { VertexTable } from "./VertexTable";

/** Represents a tesselated polyline.
 * Given a polyline as a line string, each segment of the line string is triangulated into a quad.
 * Based on the angle between two segments, additional joint triangles may be inserted in between to enable smoothly-rounded corners.
 * @internal
 */
export interface TesselatedPolyline {
  /** 24-bit index of each vertex. */
  indices: VertexIndices;
  /** 24-bit index of the previous vertex in the polyline. */
  prevIndices: VertexIndices;
  /** 24-bit index of the next vertex in the polyline, plus 8-bit parameter describing the semantics of this vertex. */
  nextIndicesAndParams: Uint8Array;
}

/** @internal */
export interface PolylineParams {
  vertices: VertexTable;
  polyline: TesselatedPolyline;
  isPlanar: boolean;
  type: PolylineTypeFlags;
  weight: number;
  linePixels: LinePixels;
}
