/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { assert } from "@itwin/core-bentley";
import { VertexTableBuilder } from "./VertexTableBuilder";
import { VertexIndices } from "./VertexIndices";
import { VertexTable } from "./VertexTable";
import { PolylineArgs } from "../../../render/PolylineArgs";

/** Describes point string geometry to be submitted to the rendering system.
 * @internal
 */
export interface PointStringParams {
  vertices: VertexTable;
  indices: VertexIndices;
  weight: number;
}

/** @internal */
export function createPointStringParams(args: PolylineArgs, maxTextureSize: number): PointStringParams | undefined {
  if (!args.flags.isDisjoint)
    return undefined;

  const vertices = VertexTableBuilder.buildFromPolylines(args, maxTextureSize);
  if (undefined === vertices)
    return undefined;

  const polylines = args.polylines;
  let vertIndices = polylines[0];
  if (1 < polylines.length) {
    // We used to assert this wouldn't happen - apparently it does...
    vertIndices = [];
    for (const polyline of polylines)
      for (const vertIndex of polyline)
        vertIndices.push(vertIndex);
  }

  const vertexIndices = VertexIndices.fromArray(vertIndices);
  assert(vertexIndices.length === vertIndices.length);

  return {
    vertices,
    indices: vertexIndices,
    weight: args.width,
  };
}
