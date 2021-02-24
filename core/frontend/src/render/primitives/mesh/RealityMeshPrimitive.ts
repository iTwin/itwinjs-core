/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { RenderMemory } from "../../RenderMemory";
import assert = require("assert");
import { Mesh } from "./MeshPrimitives";
import { SimpleMeshPrimitive } from "./SimpleMeshPrimitive";
import { QPoint2dList } from "@bentley/imodeljs-common";

/** @internal */
export class RealityMeshPrimitive  extends SimpleMeshPrimitive implements RenderMemory.Consumer {
  static createFromMesh(mesh: Mesh): RealityMeshPrimitive | undefined {
    if (mesh.edges || mesh.polylines || !mesh.triangles)
      return undefined;     // Simple meshes have only triangles.

    return new RealityMeshPrimitive(mesh.triangles.indices, mesh.points, QPoint2dList.fromPoints(mesh.uvParams), mesh.normals);
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    stats.addRealityMesh(this.bytesUsed);
    }
}