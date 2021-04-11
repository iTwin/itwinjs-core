/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { Plane3dByOriginAndUnitNormal, Point2d } from "@bentley/geometry-core";
import { ColorDef, Frustum, QPoint2dList, QPoint3dList } from "@bentley/imodeljs-common";
import { PlanarGridProps } from "../primitives/PlanarGrid";
import { RenderMemory } from "../RenderMemory";
import { BufferHandle, BufferParameters, QBufferHandle2d, QBufferHandle3d } from "./AttributeBuffers";
import { AttributeMap } from "./AttributeMap";
import { IndexedGeometry, IndexedGeometryParams } from "./CachedGeometry";
import { GL } from "./GL";
import { RenderOrder, RenderPass } from "./RenderFlags";
import { Target } from "./Target";
import { TechniqueId } from "./TechniqueId";
import assert = require("assert");

class PlanarGridGeometryParams extends IndexedGeometryParams {

  public readonly uvParams: QBufferHandle2d;

  public constructor(positions: QBufferHandle3d, uvParams: QBufferHandle2d, indices: BufferHandle, numIndices: number, public readonly props: PlanarGridProps) {
    super(positions, indices, numIndices);
    const attrParams = AttributeMap.findAttribute("a_uvParam", TechniqueId.PlanarGrid, false);
    assert(attrParams !== undefined);
    this.buffers.addBuffer(uvParams, [BufferParameters.create(attrParams!.location, 2, GL.DataType.UnsignedShort, false, 0, 0, false)]);
    this.uvParams = uvParams;
  }
}
export class PlanarGridGeometry extends IndexedGeometry  {
  public get techniqueId(): TechniqueId { return TechniqueId.PlanarGrid; }
  public getRenderPass(_target: Target): RenderPass { return RenderPass.Translucent; }
  public collectStatistics(_stats: RenderMemory.Statistics): void { }
  public get renderOrder(): RenderOrder { return RenderOrder.UnlitSurface; }
  public readonly uvParams: QBufferHandle2d;
  public readonly planeColor: ColorDef;
  public get asPlanarGrid(): PlanarGridGeometry | undefined { return this; }

  private constructor(params: PlanarGridGeometryParams) {
    super(params);
    this.uvParams = params.uvParams;
    this.planeColor = params.props.planeColor;
  }

  public static create(frustum: Frustum, grid: PlanarGridProps): PlanarGridGeometry | undefined {
    const plane = Plane3dByOriginAndUnitNormal.create(grid.origin, grid.rMatrix.rowZ())!;
    const polygon = frustum.getIntersectionWithPlane(plane);

    if (!polygon || polygon.length < 3)
      return undefined;

    const xVector = grid.rMatrix.rowX();
    const yVector = grid.rMatrix.rowY();
    const xOrigin = xVector.dotProduct(grid.origin) % 1;
    const yOrigin = yVector.dotProduct(grid.origin) % 1;
    const params = [];
    for (const polygonPoint of polygon) {
      const x = (xOrigin + xVector.dotProduct(polygonPoint)) / grid.spacing.x;
      const y = (yOrigin + yVector.dotProduct(polygonPoint)) / grid.spacing.y;
      params.push(Point2d.create(x, y));
    }

    const qPoints = QPoint3dList.fromPoints(polygon);
    const qParams = QPoint2dList.fromPoints(params);
    const nTriangles = polygon.length - 2;
    const indices = new Uint32Array(3 * nTriangles);
    for (let i = 0, j = 0; i < nTriangles; i++) {
      indices[j++] = 0;
      indices[j++] = i + 1;
      indices[j++] = i + 2;
    }
    const pointBuffer = QBufferHandle3d.create(qPoints.params, qPoints.toTypedArray());
    const paramBuffer =  QBufferHandle2d.create(qParams.params, qParams.toTypedArray());
    const indBuffer = BufferHandle.createBuffer(GL.Buffer.Target.ElementArrayBuffer, indices);
    if (!pointBuffer || !paramBuffer || !indBuffer)
      return undefined;

    const geomParams = new PlanarGridGeometryParams(pointBuffer, paramBuffer, indBuffer, indices.length, grid);
    if (!geomParams)
      return undefined;

    return new PlanarGridGeometry(geomParams);
  }
}
