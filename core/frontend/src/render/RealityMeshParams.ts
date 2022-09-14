/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { assert } from "@itwin/core-bentley";
import {
  IndexedPolyface, Point2d, Point3d, Polyface, Range1d, Range2d, Range3d, Transform, Vector3d, XAndY, XYAndZ,
} from "@itwin/core-geometry";
import {
  OctEncodedNormal, QParams2d, QParams3d, QPoint2d, QPoint2dBuffer, QPoint3d, QPoint3dBuffer, Quantization, RenderTexture,
} from "@itwin/core-common";
import { GltfMeshData } from "../tile/internal";
import { Mesh } from "./primitives/mesh/MeshPrimitives";
import { TypedArrayBuilderOptions, Uint16ArrayBuilder } from "./primitives/VertexTableSplitter";

export interface RealityMeshParams {
  positions: QPoint3dBuffer;
  uvs: QPoint2dBuffer;
  normals?: Uint16Array;
  indices: Uint16Array;
  featureID?: number; // default 0
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
      // featureID: 0,
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

class QPoint2dBufferBuilder {
  public readonly params: QParams2d;
  public readonly buffer: Uint16ArrayBuilder;

  public constructor(range: Range2d, initialCapacity = 0) {
    this.params = QParams2d.fromRange(range);
    this.buffer = new Uint16ArrayBuilder({ initialCapacity: 2 * initialCapacity });
  }

  public pushXY(x: number, y: number): void {
    this.buffer.push(x);
    this.buffer.push(y);
  }

  public push(pt: XAndY): void {
    this.pushXY(pt.x, pt.y);
  }

  public get length(): number {
    const len = this.buffer.length;
    assert(len % 2 === 0);
    return len / 2;
  }
}

class QPoint3dBufferBuilder {
  public readonly params: QParams3d;
  public readonly buffer: Uint16ArrayBuilder;

  public constructor(range: Range3d, initialCapacity = 0) {
    this.params = QParams3d.fromRange(range);
    this.buffer = new Uint16ArrayBuilder({ initialCapacity: 3 * initialCapacity });
  }

  public pushXYZ(x: number, y: number, z: number): void {
    this.buffer.push(x);
    this.buffer.push(y);
    this.buffer.push(z);
  }

  public push(pt: XYAndZ): void {
    this.pushXYZ(pt.x, pt.y, pt.z);
  }

  public get length(): number {
    const len = this.buffer.length;
    assert(len % 3 === 0);
    return len / 3;
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
  private readonly _indices: Uint16ArrayBuilder;
  private readonly _positions: QPoint3dBufferBuilder;
  private readonly _uvs: QPoint2dBufferBuilder;
  private readonly _normals?: Uint16ArrayBuilder;

  // Scratch variables
  private readonly _q3d = new QPoint3d();
  private readonly _q2d = new QPoint2d();

  public constructor(options: RealityMeshParamsBuilderOptions) {
    this._indices = new Uint16ArrayBuilder({ initialCapacity: options.initialIndexCapacity });
    this._positions = new QPoint3dBufferBuilder(options.positionRange, options.initialVertexCapacity);
    this._uvs = new QPoint2dBufferBuilder(options.uvRange ?? new Range2d(0, 0, 1, 1), options.initialVertexCapacity);
    if (options.wantNormals)
      this._normals = new Uint16ArrayBuilder({ initialCapacity: options.initialVertexCapacity });
  }

  public addUnquantizedVertex(position: XYAndZ, uv: XAndY, normal?: XYAndZ): void {
    this._q3d.init(position, this._positions.params);
    this._q2d.init(uv, this._uvs.params);
    const oen = normal ? OctEncodedNormal.encode(normal) : undefined;
    this.addQuantizedVertex(this._q3d, this._q2d, oen);
  }

  // Original API had weird mix of quantized and unquantized, used by CesiumTerrainProvider.
  public addVertex(position: Point3d, uv: QPoint2d, normal?: number): void {
    this._q3d.init(position, this._positions.params);
    this.addQuantizedVertex(this._q3d, uv, normal);
  }

  public addQuantizedVertex(position: XYAndZ, uv: XAndY, normal?: number): void {
    assert(this._positions.length < 0xffff, "RealityMeshParams supports no more than 64k vertices");
    assert((undefined === normal) === (undefined === this._normals), "RealityMeshParams requires all vertices to have normals, or none.");

    this._positions.push(position);
    this._uvs.push(uv);
    if (undefined !== normal) {
      assert(undefined !== this._normals, "Set RealityMeshParamsBuilderOptions.wantNormals");
      this._normals.push(normal);
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
    this._indices.push(index);
  }

  public finish(): RealityMeshParams {
    assert(this._positions.length >= 3 && this._indices.length >= 3, "RealityMeshParams requires at least one triangle");
    return {
      positions: {
        params: this._positions.params,
        points: this._positions.buffer.toTypedArray(),
      },
      uvs: {
        params: this._uvs.params,
        points: this._uvs.buffer.toTypedArray(),
      },
      normals: this._normals?.toTypedArray(),
      indices: this._indices.toTypedArray(),
    };
  }
}
