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
      assert(false, "Terran normals are not currently supported");
  }

  private static _scratchZRange = Range1d.createNull();
  private static _scratchUVRange = Range2d.createNull();
  private static _scratchUVQParams = QParams2d.fromZeroToOne();
  public upsample(uvSampleRange: Range2d): { heightRange: Range1d, mesh: TerrainMeshPrimitive } {
    const indexMap = new UpsampleIndexMap();
    const uvLow = QPoint2d.create(uvSampleRange.low, TerrainMeshPrimitive._scratchUVQParams);
    const uvHigh = QPoint2d.create(uvSampleRange.high, TerrainMeshPrimitive._scratchUVQParams);

    for (let i = 0; i < this.indices.length;) {
      const triangleIndices = [this.indices[i++], this.indices[i++], this.indices[i++]];

      const triangleRange = Range2d.createNull(TerrainMeshPrimitive._scratchUVRange);
      for (const index of triangleIndices)
        triangleRange.extendPoint(this.uvParams.list[index]);

      if (!(uvLow.x > triangleRange.high.x
        || uvLow.y > triangleRange.high.y
        || triangleRange.low.x > uvHigh.x
        || triangleRange.low.y > uvHigh.y))
        indexMap.addTriangle(triangleIndices);
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
}

export namespace TerrainMesh {
  export interface Props {
    /*** Mesh range -- used for quantization */
    readonly range: Range3d;

  }
}
