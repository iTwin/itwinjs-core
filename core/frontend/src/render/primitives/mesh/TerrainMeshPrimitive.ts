/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { Range2d, Range3d, Vector3d, Point3d, Range1d } from "@bentley/geometry-core";
import {
  QParams2d,
  QPoint3dList,
  QParams3d,
  QPoint2dList,
  QPoint2d,
  Quantization,
  QPoint3d,
} from "@bentley/imodeljs-common";
import { assert } from "@bentley/bentleyjs-core";
import { RenderMemory } from "../../RenderMemory";

export enum Child { Q00, Q01, Q10, Q11 }

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
class ClipAxis {
  constructor(public vertical: boolean, public lessThan: boolean, public value: number) { }
}

/**  These are currently retained on terrain leaf tiles for upsampling.
 * It may be worthwhile to pack the data into buffers...
 * @internal.
 */
export class TerrainMeshPrimitive implements RenderMemory.Consumer {
  public readonly indices: number[];
  public readonly points: QPoint3dList;
  public readonly uvParams: QPoint2dList;
  public readonly featureID: number = 0;

  private constructor(pointParams: QParams3d, indices?: number[]) {
    this.points = new QPoint3dList(pointParams);
    this.uvParams = new QPoint2dList(QParams2d.fromRange(Range2d.createXYXY(0, 0, 1, 1)));
    this.indices = indices ? indices : new Array<number>();
  }
  public static create(props: TerrainMesh.Props, indices?: number[]) {
    return new TerrainMeshPrimitive(QParams3d.fromRange(props.range), indices);
  }
  public get bytesUsed() {
    return 8 * (this.indices.length + this.points.length * 3 + this.uvParams.length * 2);
  }
  public collectStatistics(stats: RenderMemory.Statistics): void {
    stats.addTerrain(this.bytesUsed);
  }

  public addVertex(point: Point3d, uvParam: QPoint2d, normal?: Vector3d) {
    this.points.add(point);
    this.uvParams.push(uvParam.clone());
    if (undefined !== normal)
      assert(false, "Terrain normals are not currently supported");
  }

  private static _scratchZRange = Range1d.createNull();
  private static _scratchTriangleRange = Range2d.createNull();
  private static _scratchUVRange = Range2d.createNull();
  private static _scratchUVQParams = QParams2d.fromZeroToOne();
  public upsample(uvSampleRange: Range2d): { heightRange: Range1d, mesh: TerrainMeshPrimitive } {
    const indexMap = new UpsampleIndexMap();
    const uvLow = QPoint2d.create(uvSampleRange.low, TerrainMeshPrimitive._scratchUVQParams);
    const uvHigh = QPoint2d.create(uvSampleRange.high, TerrainMeshPrimitive._scratchUVQParams);
    const uvRange = Range2d.createXYXY(uvLow.x, uvLow.y, uvHigh.x, uvHigh.y, TerrainMeshPrimitive._scratchUVRange);
    const clipAxes = new Array<ClipAxis>();
    if (uvLow.x > 0)
      clipAxes.push(new ClipAxis(true, false, uvLow.x));
    if (uvHigh.x < Quantization.rangeScale16)
      clipAxes.push(new ClipAxis(true, true, uvHigh.x));
    if (uvLow.y > 0)
      clipAxes.push(new ClipAxis(false, false, uvLow.y));
    if (uvHigh.y < Quantization.rangeScale16)
      clipAxes.push(new ClipAxis(false, true, uvHigh.y));

    for (let i = 0; i < this.indices.length;) {
      const triangleIndices = [this.indices[i++], this.indices[i++], this.indices[i++]];

      const triangleRange = Range2d.createNull(TerrainMeshPrimitive._scratchTriangleRange);
      for (const index of triangleIndices)
        triangleRange.extendPoint(this.uvParams.list[index]);

      if (uvRange.intersectsRange(triangleRange)) {
        if (uvRange.containsRange(triangleRange)) {
          indexMap.addTriangle(triangleIndices);
        } else {
          this.addClipped(triangleIndices, indexMap, clipAxes, 0);
        }
      }
    }

    const parentPoints = this.points.list;
    const parentParams = this.uvParams.list;
    const qParams = this.points.params;

    const zRange = Range1d.createNull(TerrainMeshPrimitive._scratchZRange);
    const mesh = new TerrainMeshPrimitive(qParams, indexMap.indices);
    for (const mapEntry of indexMap.entries()) {
      const parentIndex = mapEntry[0];
      const parentPoint = parentPoints[parentIndex];
      zRange.extendX(parentPoint.z);
      mesh.points.list.push(parentPoint);
      mesh.uvParams.list.push(parentParams[parentIndex]);
    }
    const heightRange = Range1d.createXX(Quantization.unquantize(zRange.low, qParams.origin.z, qParams.scale.z), Quantization.unquantize(zRange.high, qParams.origin.z, qParams.scale.z));
    return { heightRange, mesh };
  }
  private addClipped(triangleIndices: number[], indexMap: UpsampleIndexMap, clipAxes: ClipAxis[], clipIndex: number) {
    if (clipIndex === clipAxes.length) {
      indexMap.addTriangle(triangleIndices);
      return;
    }

    const inside = new Array<boolean>(3);
    const values = new Array<number>(3);
    const clipOutput = new Array<number>();
    const clipAxis = clipAxes[clipIndex++];
    const parentPoints = this.points.list;
    const parentParams = this.uvParams.list;
    const clipValue = clipAxis.value;
    for (let i = 0; i < 3; i++) {
      const index = triangleIndices[i];
      const thisValue = clipAxis.vertical ? parentParams[index].x : parentParams[index].y;
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

        clipOutput.push(parentPoints.length);
        parentPoints.push(interpolateQPoint3d(parentPoints[index], parentPoints[nextIndex], fraction));
        parentParams.push(interpolateQPoint2d(parentParams[index], parentParams[nextIndex], fraction));
      }
    }
    if (clipOutput.length > 2) {
      this.addClipped(clipOutput.slice(0, 3), indexMap, clipAxes, clipIndex);
      if (clipOutput.length > 3)
        this.addClipped([clipOutput[0], clipOutput[2], clipOutput[3]], indexMap, clipAxes, clipIndex);
    }
  }
}
function interpolate(value0: number, value1: number, fraction: number) { return Math.floor(.5 + value0 + (value1 - value0) * fraction); }
function interpolateQPoint3d(p0: QPoint3d, p1: QPoint3d, fraction: number): QPoint3d {
  return QPoint3d.fromScalars(interpolate(p0.x, p1.x, fraction), interpolate(p0.y, p1.y, fraction), interpolate(p0.z, p1.z, fraction));
}

function interpolateQPoint2d(p0: QPoint2d, p1: QPoint2d, fraction: number): QPoint2d {
  return QPoint2d.fromScalars(interpolate(p0.x, p1.x, fraction), interpolate(p0.y, p1.y, fraction));
}

export namespace TerrainMesh {
  export interface Props {
    /*** Mesh range -- used for quantization */
    readonly range: Range3d;

  }
}
