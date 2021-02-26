/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { OctEncodedNormal, QPoint2dList, QPoint3dList, RenderTexture } from "@bentley/imodeljs-common";
import { RenderMemory } from "../../RenderMemory";
import { Mesh } from "./MeshPrimitives";
import { SimpleMeshPrimitive } from "./SimpleMeshPrimitive";

/** @internal */
export class RealityMeshPrimitive  extends SimpleMeshPrimitive implements RenderMemory.Consumer {
  protected constructor(indices: number[], points: QPoint3dList, uvParams: QPoint2dList, normals: OctEncodedNormal[], public readonly texture: RenderTexture) {
    super(indices, points, uvParams, normals);
  }

  public static createFromMesh(mesh: Mesh): RealityMeshPrimitive | undefined {
    if (mesh.edges || mesh.polylines || !mesh.triangles || !mesh.displayParams.textureMapping)
      return undefined;     // Simple meshes have only triangles and are textured.

    return new RealityMeshPrimitive(mesh.triangles.indices, mesh.points, QPoint2dList.fromPoints(mesh.uvParams), mesh.normals, mesh.displayParams.textureMapping.texture);
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    stats.addRealityMesh(this.bytesUsed);
  }
}
