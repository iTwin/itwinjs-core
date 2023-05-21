/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { assert } from "@itwin/core-bentley";
import { PolylineArgs } from "./mesh/MeshPrimitives";
import { VertexTableBuilder } from "./VertexTableBuilder";
import { PointStringParams } from "../../common/render/primitives/PointStringParams";
import { VertexIndices } from "../../common/render/primitives/VertexIndices";
import { IModelApp } from "../../IModelApp";

export function createPointStringParams(args: PolylineArgs): PointStringParams | undefined {
  if (!args.flags.isDisjoint)
    return undefined;

  const vertices = VertexTableBuilder.buildFromPolylines(args, IModelApp.renderSystem.maxTextureSize);
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

  return {
    vertices,
    indices: vertexIndices,
    weight: args.width,
  };
}
