/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { OctEncodedNormal, QParams2d, QParams3d, RenderTexture } from "@bentley/imodeljs-common";
import { GltfMeshData } from "../../../tile/internal";
import { RenderMemory } from "../../RenderMemory";
import { Mesh } from "./MeshPrimitives";

/** @internal */
export class RealityMeshPrimitive implements RenderMemory.Consumer {
  public readonly indices: Uint16Array;
  public readonly pointQParams: QParams3d;
  public readonly points: Uint16Array;
  public readonly normals: OctEncodedNormal[];
  public readonly uvQParams: QParams2d;
  public readonly uvs: Uint16Array;
  public readonly featureID: number = 0;
  protected constructor(indices: Uint16Array, pointQParams: QParams3d, points: Uint16Array, uvQParams: QParams2d, uvs: Uint16Array, normals: OctEncodedNormal[], public readonly texture: RenderTexture) {
    this.pointQParams = pointQParams;
    this.points = points;
    this.uvQParams = uvQParams;
    this.uvs = uvs;
    this.normals = normals;
    this.indices = indices;
  }

  public static createFromGltfMesh(mesh: GltfMeshData): RealityMeshPrimitive | undefined {
    if (mesh.props.type !== Mesh.PrimitiveType.Mesh || mesh.edges || !mesh.props.displayParams.textureMapping || !mesh.pointQParams || !mesh.uvQParams || !mesh.points || !mesh.uvs || !mesh.indices)
      return undefined;     // Simple meshes have only triangles without edges and are textured.

    return new RealityMeshPrimitive(mesh.indices, mesh.pointQParams, mesh.points, mesh.uvQParams, mesh.uvs, mesh.normals, mesh.props.displayParams.textureMapping.texture);
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    stats.addRealityMesh(this.bytesUsed);
  }
  public get bytesUsed() {
    return 8 * (this.indices.length + this.points.length * 3 + this.uvs.length * 2) + 2 * this.normals.length;
  }
}
