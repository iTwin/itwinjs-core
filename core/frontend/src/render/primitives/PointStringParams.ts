/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { assert } from "@itwin/core-bentley";
import { PolylineArgs } from "./mesh/MeshPrimitives";
import { VertexIndices, VertexTable } from "./VertexTable";

/** Describes point string geometry to be submitted to the rendering system.
 * @internal
 */
export class PointStringParams {
  public readonly vertices: VertexTable;
  public readonly indices: VertexIndices;
  public readonly weight: number;

  public constructor(vertices: VertexTable, indices: VertexIndices, weight: number) {
    this.vertices = vertices;
    this.indices = indices;
    this.weight = weight;
  }

  public static create(args: PolylineArgs): PointStringParams | undefined {
    if (!args.flags.isDisjoint)
      return undefined;

    const vertices = VertexTable.createForPolylines(args);
    if (undefined === vertices)
      return undefined;

    const polylines = args.polylines;
    let vertIndices = polylines[0].vertIndices;
    if (1 < polylines.length) {
      // We used to assert this wouldn't happen - apparently it does...
      vertIndices = [];
      for (const polyline of polylines)
        for (const vertIndex of polyline.vertIndices)
          vertIndices.push(vertIndex);
    }

    const vertexIndices = VertexIndices.fromArray(vertIndices);
    assert(vertexIndices.length === vertIndices.length);

    return new PointStringParams(vertices, vertexIndices, args.width);
  }
}
