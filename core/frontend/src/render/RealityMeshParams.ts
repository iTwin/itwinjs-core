/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { IndexedPolyface, Point2d, Point3d, Polyface, Transform, Vector3d } from "@itwin/core-geometry";
import { OctEncodedNormal, QPoint2dBuffer, QPoint3dBuffer, RenderTexture } from "@itwin/core-common";
import { GltfMeshData } from "../tile/internal";
import { Mesh } from "./primitives/mesh/MeshPrimitives";

export interface RealityMeshParams {
  positions: QPoint3dBuffer;
  uvs: QPoint2dBuffer;
  normals?: Uint16Array;
  indices: Uint16Array;
  featureID: number;
  texture?: RenderTexture;
}

export namespace RealityMeshParams {
  export function fromGltfMesh(mesh: GltfMeshData): RealityMeshParams | undefined {
    // The specialized reality mesh shaders expect a mesh with 16-bit indices, uvs, and no edges.
    if (mesh.primitive.type !== Mesh.PrimitiveType.Mesh || mesh.primitive.edges || !mesh.pointQParams || !mesh.uvQParams || !mesh.points || !mesh.uvs || !mesh.indices || !(mesh.indices instanceof Uint16Array))
      return undefined;

    return {
      indices: mesh.indices,
      positions: {
        params: mesh.pointQParams,
        points: mesh.points,
      },
      uvs: {
        params: mesh.uvQParams,
        points: mesh.uvs,
      },
      normals: mesh.normals,
      featureID: 0,
      texture: mesh.primitive.displayParams.textureMapping?.texture,
    };
  }

  export function toPolyface(params: RealityMeshParams, options?: { transform?: Transform, wantNormals?: boolean, wantParams?: boolean }): Polyface | undefined {
    const { positions, normals, uvs, indices } = params;
    const includeNormals = options?.wantNormals && undefined !== normals;
    const includeParams = options?.wantParams;

    const polyface = IndexedPolyface.create(includeNormals, includeParams);
    const points = positions.points;
    const point = new Point3d();
    const transform = options?.transform;
    for (let i = 0; i < positions.points.length; i += 3) {
      positions.params.unquantize(points[i], points[i + 1], points[i + 2], point);
      transform?.multiplyPoint3d(point, point);
      polyface.addPoint(point);
    }

    if (includeNormals) {
      const normal = new Vector3d();
      for (let i = 0; i < normals.length; i++)
        polyface.addNormal(OctEncodedNormal.decodeValue(normals[i], normal));
    }

    if (includeParams) {
      const uv = new Point2d();
      for (let i = 0; i < uvs.points.length; i += 2)
        polyface.addParam(uvs.params.unquantize(uvs.points[i], uvs.points[i + 1], uv));
    }

    let j = 0;
    indices.forEach((index: number) => {
      polyface.addPointIndex(index);
      if (includeNormals)
        polyface.addNormalIndex(index);

      if (includeParams)
        polyface.addParamIndex(index);

      if (0 === (++j % 3))
        polyface.terminateFacet();
    });

    return polyface;
  }
}
