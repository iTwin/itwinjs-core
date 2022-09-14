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

class UpsampleIndexMap extends Map<number, number> {
  private _next = 0;
  public indices = new Array<number>();

  public addTriangle(indices: number[]) {
    for (const index of indices) {
      let mapIndex = this.get(index);
      if (undefined === mapIndex)
        this.set(index, mapIndex = this._next++);

      this.indices.push(mapIndex);
    }
  }
}

export interface UpsampledRealityMeshParams {
  heightRange: Range1d;
  mesh: RealityMeshParams;
}

class ClipAxis {
  constructor(public vertical: boolean, public lessThan: boolean, public value: number) { }
}

export function upsampleRealityMeshParams(params: RealityMeshParams, uvSampleRange: Range2d): UpsampledRealityMeshParams {
  const indexMap = new UpsampleIndexMap();
  const uvParams = QParams2d.fromZeroToOne();
  const uvLow = QPoint2d.create(uvSampleRange.low, uvParams);
  const uvHigh = QPoint2d.create(uvSampleRange.high, uvParams);
  const uvRange = Range2d.createXYXY(uvLow.x, uvLow.y, uvHigh.x, uvHigh.y);

  const clipAxes = new Array<ClipAxis>();
  const addedPoints = new Array<QPoint3d>(), addedParams = new Array<QPoint2d>(), addedNormals = new Array<number>();
  if (uvLow.x > 0)
    clipAxes.push(new ClipAxis(true, false, uvLow.x));
  if (uvHigh.x < Quantization.rangeScale16)
    clipAxes.push(new ClipAxis(true, true, uvHigh.x));
  if (uvLow.y > 0)
    clipAxes.push(new ClipAxis(false, false, uvLow.y));
  if (uvHigh.y < Quantization.rangeScale16)
    clipAxes.push(new ClipAxis(false, true, uvHigh.y));

  const triangleRange = Range2d.createNull();
  for (let i = 0; i < params.indices.length;) {
    const triangleIndices = [params.indices[i++], params.indices[i++], params.indices[i++]];

    Range2d.createNull(triangleRange);
    for (const index of triangleIndices) {
      const paramIndex = 2 * index;
      triangleRange.extendXY(params.uvs.points[paramIndex], params.uvs.points[paramIndex + 1]);
    }

    if (uvRange.intersectsRange(triangleRange)) {
      if (uvRange.containsRange(triangleRange)) {
        indexMap.addTriangle(triangleIndices);
      } else {
        addClipped(params, triangleIndices, indexMap, clipAxes, 0, addedPoints, addedParams, addedNormals);
      }
    }
  }

  const parentPoints = params.positions;
  const parentParams = params.uvs;
  const parentNormals = params.normals;
  const parentPointCount = parentPoints.points.length / 3;

  const zRange = Range1d.createNull();
  const builder = new RealityMeshParamsBuilder({
    positionRange: parentPoints.params.computeRange(),
    initialVertexCapacity: indexMap.size,
    initialIndexCapacity: indexMap.indices.length,
    wantNormals: parentNormals !== undefined,
  });

  const pos = new QPoint3d();
  const uv = new QPoint2d();
  for (const entry of indexMap.entries()) {
    const parentIndex = entry[0];
    let normal: number | undefined;
    if (parentIndex < parentPointCount) {
      const pointIndex = 3 * parentIndex;
      pos.setFromScalars(parentPoints.points[pointIndex], parentPoints.points[pointIndex + 1], parentPoints.points[pointIndex + 2]);
      const paramIndex = 2 * parentIndex;
      uv.setFromScalars(parentParams.points[paramIndex], parentParams.points[paramIndex + 1]);
      if (parentNormals)
        normal = parentNormals[parentIndex];
    } else {
      const addedIndex = parentIndex - parentPointCount;
      addedPoints[addedIndex].clone(pos);
      addedParams[addedIndex].clone(uv);
      if (addedNormals.length > 0)
        normal = addedNormals[addedIndex];
    }

    builder.addQuantizedVertex(pos, uv, normal);
    zRange.extendX(pos.z);
  }

  builder.addIndices(indexMap.indices);

  const mesh = builder.finish();
  const qParams = mesh.positions.params;
  return {
    mesh: builder.finish(),
    heightRange: Range1d.createXX(
      Quantization.unquantize(zRange.low, qParams.origin.z, qParams.scale.z),
      Quantization.unquantize(zRange.high, qParams.origin.z, qParams.scale.z)
    ),
  };
}

function interpolate(value0: number, value1: number, fraction: number) {
  return value0 + (value1 - value0) * fraction;
}

function interpolateInt(value0: number, value1: number, fraction: number) {
  return Math.floor(.5 + interpolate(value0, value1, fraction));
}

function interpolateQPoint3d(qPoint: QPoint3d, qNext: QPoint3d, fraction: number): QPoint3d {
  return QPoint3d.fromScalars(interpolateInt(qPoint.x, qNext.x, fraction), interpolateInt(qPoint.y, qNext.y, fraction), interpolateInt(qPoint.z, qNext.z, fraction));
}

function interpolateQPoint2d(qPoint: QPoint2d, qNext: QPoint2d, fraction: number): QPoint2d {
  return QPoint2d.fromScalars(interpolateInt(qPoint.x, qNext.x, fraction), interpolateInt(qPoint.y, qNext.y, fraction));
}

function interpolateOctEncodedNormal(normal0: number, normal1: number, fraction: number): number {
  const n0 = OctEncodedNormal.decodeValue(normal0);
  const n1 = OctEncodedNormal.decodeValue(normal1);
  if (undefined !== n0 && undefined !== n1) {
    const n = Vector3d.create(interpolate(n0.x, n1.x, fraction), interpolate(n0.y, n1.y, fraction), interpolate(n0.z, n1.z, fraction));
    n.normalizeInPlace();
    return OctEncodedNormal.encode(n);
  } else {
    return OctEncodedNormal.encode(Vector3d.create(0, 0, 1));
  }
}

function addClipped(params: RealityMeshParams, triangleIndices: number[], indexMap: UpsampleIndexMap, clipAxes: ClipAxis[], clipIndex: number, addedPoints: QPoint3d[], addedParams: QPoint2d[], addedNormals: number[]) {
  if (clipIndex === clipAxes.length) {
    indexMap.addTriangle(triangleIndices);
    return;
  }

  const inside = [false, false, false];
  const values = [0, 0, 0];
  const clipOutput: number[] = [];

  const parentPoints = params.positions.points;
  const parentParams = params.uvs.points;
  const parentNormals = params.normals;

  const clipAxis = clipAxes[clipIndex++];
  const clipValue = clipAxis.value;

  const parentPointCount = parentPoints.length / 3;
  const scratchQPoint3d = new QPoint3d(), scratchQPoint3d1 = new QPoint3d();
  const scratchQPoint2d = new QPoint2d(), scratchQPoint2d1 = new QPoint2d();

  const getPoint = (index: number, result: QPoint3d): QPoint3d => {
    if (index < parentPointCount) {
      const pointIndex = index * 3;
      result.setFromScalars(parentPoints[pointIndex], parentPoints[pointIndex + 1], parentPoints[pointIndex + 2]);
    } else {
      addedPoints[index - parentPointCount].clone(result);
    }

    return result;
  };

  const getParam = (index: number, result: QPoint2d): QPoint2d => {
    if (index < parentPointCount) {
      const pointIndex = index * 2;
      result.setFromScalars(parentParams[pointIndex], parentParams[pointIndex + 1]);
    } else {
      addedParams[index - parentPointCount].clone(result);
    }
    return result;
  };

  const getNormal = (index: number): number | undefined => {
    if (!parentNormals)
      return undefined;

    return (index < parentPointCount) ? parentNormals[index] : addedNormals[index - parentPointCount];
  };

  for (let i = 0; i < 3; i++) {
    const index = triangleIndices[i];
    const thisParam = getParam(index, scratchQPoint2d);
    const thisValue = clipAxis.vertical ? thisParam.x : thisParam.y;
    values[i] = thisValue;
    inside[i] = clipAxis.lessThan ? (thisValue < clipValue) : (thisValue > clipValue);
  }

  for (let i = 0; i < 3; i++) {
    const index = triangleIndices[i];
    const next = (i + 1) % 3;
    if (inside[i])
      clipOutput.push(index);
    if (inside[i] !== inside[next]) {
      const nextIndex = triangleIndices[next];
      const fraction = (clipValue - values[i]) / (values[next] - values[i]);

      clipOutput.push(parentPointCount + addedPoints.length);
      addedPoints.push(interpolateQPoint3d(getPoint(index, scratchQPoint3d), getPoint(nextIndex, scratchQPoint3d1), fraction));
      addedParams.push(interpolateQPoint2d(getParam(index, scratchQPoint2d), getParam(nextIndex, scratchQPoint2d1), fraction));
      if (parentNormals)
        addedNormals.push(interpolateOctEncodedNormal(getNormal(index)!, getNormal(nextIndex)!, fraction));

    }
  }

  if (clipOutput.length > 2) {
    addClipped(params, clipOutput.slice(0, 3), indexMap, clipAxes, clipIndex, addedPoints, addedParams, addedNormals);
    if (clipOutput.length > 3)
      addClipped(params, [clipOutput[0], clipOutput[2], clipOutput[3]], indexMap, clipAxes, clipIndex, addedPoints, addedParams, addedNormals);
  }
}
