/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import {
  Range1d, Range2d, Vector3d,
} from "@itwin/core-geometry";
import {
  OctEncodedNormal, QParams2d, QPoint2d, QPoint3d, Quantization,
} from "@itwin/core-common";
import { RealityMeshParams, RealityMeshParamsBuilder } from "./RealityMeshParams";

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
      Quantization.unquantize(zRange.high, qParams.origin.z, qParams.scale.z),
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

