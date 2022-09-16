/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { assert, Uint16ArrayBuilder } from "@itwin/core-bentley";
import {
  IndexedPolyface, Point2d, Point3d, Polyface, Range2d, Range3d, Transform, Vector3d, XAndY, XYAndZ,
} from "@itwin/core-geometry";
import {
  OctEncodedNormal, QPoint2d, QPoint2dBuffer, QPoint2dBufferBuilder, QPoint3d, QPoint3dBuffer, QPoint3dBufferBuilder, RenderTexture,
} from "@itwin/core-common";
import { GltfMeshData } from "../tile/internal";
import { Mesh } from "./primitives/mesh/MeshPrimitives";

/**
 * @beta
 */
export interface RealityMeshParams {
  positions: QPoint3dBuffer;
  uvs: QPoint2dBuffer;
  normals?: Uint16Array;
  indices: Uint16Array;
  /** @alpha unused by terrain meshes */
  featureID?: number; // default 0
  /** @alpha unused by terrain meshes */
  texture?: RenderTexture;
}

/** @beta */
export namespace RealityMeshParams {
  /** @internal */
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
      // featureID: 0,
      texture: mesh.primitive.displayParams.textureMapping?.texture,
    };
  }

  /** @alpha */
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
      for (const oen of normals)
        polyface.addNormal(OctEncodedNormal.decodeValue(oen, normal));
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

export interface RealityMeshParamsBuilderOptions {
  positionRange: Range3d;
  uvRange?: Range2d; // default [0..1]
  wantNormals?: boolean;
  initialVertexCapacity?: number;
  initialIndexCapacity?: number;
}

export class RealityMeshParamsBuilder {
  public readonly indices: Uint16ArrayBuilder;
  public readonly positions: QPoint3dBufferBuilder;
  public readonly uvs: QPoint2dBufferBuilder;
  public readonly normals?: Uint16ArrayBuilder;

  // Scratch variables
  private readonly _q3d = new QPoint3d();
  private readonly _q2d = new QPoint2d();

  public constructor(options: RealityMeshParamsBuilderOptions) {
    this.indices = new Uint16ArrayBuilder({ initialCapacity: options.initialIndexCapacity });
    if (options.wantNormals)
      this.normals = new Uint16ArrayBuilder({ initialCapacity: options.initialVertexCapacity });

    this.positions = new QPoint3dBufferBuilder({
      range: options.positionRange,
      initialCapacity: options.initialVertexCapacity,
    });

    this.uvs = new QPoint2dBufferBuilder({
      range: options.uvRange ?? new Range2d(0, 0, 1, 1),
      initialCapacity: options.initialVertexCapacity,
    });
  }

  public addUnquantizedVertex(position: XYAndZ, uv: XAndY, normal?: XYAndZ): void {
    this._q3d.init(position, this.positions.params);
    this._q2d.init(uv, this.uvs.params);
    const oen = normal ? OctEncodedNormal.encode(normal) : undefined;
    this.addQuantizedVertex(this._q3d, this._q2d, oen);
  }

  // Original API had weird mix of quantized and unquantized, used by CesiumTerrainProvider.
  public addVertex(position: Point3d, uv: QPoint2d, normal?: number): void {
    this._q3d.init(position, this.positions.params);
    this.addQuantizedVertex(this._q3d, uv, normal);
  }

  public addQuantizedVertex(position: XYAndZ, uv: XAndY, normal?: number): void {
    assert(this.positions.length < 0xffff, "RealityMeshParams supports no more than 64k vertices");
    assert((undefined === normal) === (undefined === this.normals), "RealityMeshParams requires all vertices to have normals, or none.");

    this.positions.push(position);
    this.uvs.push(uv);
    if (undefined !== normal) {
      assert(undefined !== this.normals, "Set RealityMeshParamsBuilderOptions.wantNormals");
      this.normals.push(normal);
    }
  }

  public addTriangle(i0: number, i1: number, i2: number): void {
    this.addIndex(i0);
    this.addIndex(i1);
    this.addIndex(i2);
  }

  public addQuad(i0: number, i1: number, i2: number, i3: number): void {
    this.addTriangle(i0, i1, i2);
    this.addTriangle(i1, i3, i2);
  }

  public addIndices(indices: Iterable<number>): void {
    for (const index of indices)
      this.addIndex(index);
  }

  private addIndex(index: number): void {
    assert(index <= 0xffff, "RealityMeshParams supports no more than 64k vertices");
    this.indices.push(index);
  }

  public finish(): RealityMeshParams {
    assert(this.positions.length >= 3 && this.indices.length >= 3, "RealityMeshParams requires at least one triangle");
    return {
      positions: this.positions.finish(),
      uvs: this.uvs.finish(),
      normals: this.normals?.toTypedArray(),
      indices: this.indices.toTypedArray(),
    };
  }
}
