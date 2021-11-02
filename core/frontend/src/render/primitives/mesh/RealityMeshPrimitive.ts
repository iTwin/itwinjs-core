/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { QParams2d, QParams3d, RenderTexture } from "@itwin/core-common";
import { GltfMeshData } from "../../../tile/internal";
import { RenderMemory } from "../../RenderMemory";
import { Mesh } from "./MeshPrimitives";

export interface RealityMeshProps {
  readonly indices: Uint16Array;
  readonly pointQParams: QParams3d;
  readonly points: Uint16Array;
  readonly normals?: Uint16Array;
  readonly uvQParams: QParams2d;
  readonly uvs: Uint16Array;
  readonly featureID: number;
  readonly texture?: RenderTexture;
}

/** @internal */
export class RealityMeshPrimitive implements RenderMemory.Consumer {
  public readonly indices: Uint16Array;
  public readonly pointQParams: QParams3d;
  public readonly points: Uint16Array;
  public readonly normals?: Uint16Array;
  public readonly uvQParams: QParams2d;
  public readonly uvs: Uint16Array;
  public readonly featureID: number = 0;
  public readonly texture?: RenderTexture;
  protected constructor(props: RealityMeshProps) {
    this.pointQParams = props.pointQParams;
    this.points = props.points;
    this.uvQParams = props.uvQParams;
    this.uvs = props.uvs;
    this.normals = props.normals;
    this.indices = props.indices;
    this.featureID = props.featureID;
    this.texture = props.texture;
  }

  public static createFromGltfMesh(mesh: GltfMeshData): RealityMeshPrimitive | undefined {
    if (mesh.primitive.type !== Mesh.PrimitiveType.Mesh || mesh.primitive.edges || !mesh.primitive.displayParams.textureMapping || !mesh.pointQParams || !mesh.uvQParams || !mesh.points || !mesh.uvs || !mesh.indices || !(mesh.indices instanceof Uint16Array))
      return undefined;     // Simple meshes have only triangles without edges and are textured.

    return new RealityMeshPrimitive({ indices: mesh.indices, pointQParams: mesh.pointQParams, points: mesh.points, uvQParams: mesh.uvQParams, uvs: mesh.uvs, normals: mesh.normals, featureID: 0, texture: mesh.primitive.displayParams.textureMapping.texture });
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    stats.addTerrain(this.bytesUsed);
  }
  public get bytesUsed() {
    return 2 * (this.indices.length + this.points.length  + this.uvs.length + (this.normals ? this.normals.length : 0));
  }
}
