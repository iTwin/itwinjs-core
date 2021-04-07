/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { Plane3dByOriginAndUnitNormal } from "@bentley/geometry-core";
import { Frustum, QPoint3dList } from "@bentley/imodeljs-common";
import { PlanarGridProps } from "../primitives/PlanarGrid";
import { RenderMemory } from "../RenderMemory";
import { IndexedGeometry, IndexedGeometryParams } from "./CachedGeometry";
import { RenderOrder, RenderPass } from "./RenderFlags";
import { Target } from "./Target";
import { TechniqueId } from "./TechniqueId";

export class PlanarGridGeometry extends IndexedGeometry  {

  public get techniqueId(): TechniqueId { return TechniqueId.PlanarGrid; }
  public getRenderPass(_target: Target): RenderPass { return RenderPass.WorldOverlay; }
  public collectStatistics(_stats: RenderMemory.Statistics): void { }
  public get renderOrder(): RenderOrder { return RenderOrder.UnlitSurface; }

  public static create(frustum: Frustum, grid: PlanarGridProps): PlanarGridGeometry | undefined {
    const plane = Plane3dByOriginAndUnitNormal.create(grid.origin, grid.rMatrix.rowZ())!;
    const polygon = frustum.getIntersectionWithPlane(plane);

    if (!polygon || polygon.length < 3)
      return undefined;

    const qPoints = QPoint3dList.fromPoints(polygon);
    const nTriangles = polygon.length - 2;
    const indices = new Uint32Array(3 * nTriangles);
    for (let i = 0, j = 0; i < nTriangles; i++) {
      indices[j++] = 0;
      indices[j++] = i + 1;
      indices[j++] = i + 2;
    }

    const geomParams = IndexedGeometryParams.create(qPoints.toTypedArray(), qPoints.params, indices);
    if (!geomParams)
      return undefined;
    return geomParams ? new PlanarGridGeometry(geomParams) : undefined;
  }
}
