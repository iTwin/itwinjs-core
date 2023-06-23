/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert } from "@itwin/core-bentley";
import { Angle, Ellipsoid, EllipsoidPatch, Point2d, Point3d, Range1d, Range3d, Transform } from "@itwin/core-geometry";
import { RealityMeshParams, RealityMeshParamsBuilder } from "../../render/RealityMeshParams";
import {
  MapCartoRectangle, MapTile, MapTilingScheme, QuadId, ReadMeshArgs, TerrainMeshProvider, TerrainMeshProviderOptions, TileRequest, WebMercatorTilingScheme,
} from "../internal";

const scratchPoint2d = Point2d.createZero();
const scratchPoint = Point3d.createZero();
const scratchEllipsoid = Ellipsoid.create(Transform.createIdentity());
const scratchZeroRange = Range1d.createXX(0, 0);

/** A terrain mesh provider that produces geometry that represents a smooth ellipsoid without any height perturbations.
 * The area within the project extents are represented as planar tiles and other tiles are facetted approximations
 * of the WGS84 ellipsoid.
 * This is the terrain provider used when the background map is enabled but 3d terrain is disabled.
 * @public
 */
export class EllipsoidTerrainProvider extends TerrainMeshProvider {
  private _tilingScheme = new WebMercatorTilingScheme();
  private readonly _wantSkirts: boolean;

  /** Construct a new terrain provider.
   * @note [[TerrainMeshProviderOptions.wantNormals]] is ignored - no normals are produced.
   */
  public constructor(opts: TerrainMeshProviderOptions) {
    super();
    this._wantSkirts = opts.wantSkirts;
  }

  /** Implements [[TerrainMeshProvider.maxDepth]] to return a fixed maximum depth of 22. */
  public get maxDepth(): number { return 22; }

  /** Implements [[TerrainMeshProvider.getChildHeightRange]] to return an empty range, because the ellipsoid is smooth. */
  public override getChildHeightRange(_quadId: QuadId, _rectangle: MapCartoRectangle, _parent: MapTile): Range1d | undefined {
    return scratchZeroRange;
  }

  /** Implements [[TerrainMeshProvider.tilingScheme]]. */
  public override get tilingScheme(): MapTilingScheme {
    return this._tilingScheme;
  }

  private createSkirtlessPlanarMesh(tile: MapTile): RealityMeshParams {
    const projection = tile.getProjection();
    const builder = new RealityMeshParamsBuilder({
      positionRange: projection.localRange,
      initialVertexCapacity: 4,
      initialIndexCapacity: 6,
    });

    const uv = new Point2d();
    const pos = new Point3d();
    for (let v = 0; v < 2; v++) {
      for (let u = 0; u < 2; u++) {
        Point2d.create(u, 1 - v, uv);
        builder.addUnquantizedVertex(projection.getPoint(u, v, 0, pos), uv);
      }

    }

    builder.addQuad(0, 1, 2, 3);
    return builder.finish();
  }

  private createSkirtedPlanarMesh(tile: MapTile): RealityMeshParams {
    const projection = tile.getProjection();
    const positions: Point3d[] = [];
    const uvs: Point2d[] = [];

    const skirtHeight = tile.range.xLength() / 20;
    for (let v = 0, i = 0; v < 2; v++) {
      for (let u = 0; u < 2; u++) {
        for (let h = 0; h < 2; h++) {
          positions.push(projection.getPoint(u, v, h * skirtHeight));
          uvs[i] = new Point2d(u, 1 - v);
          i++;
        }
      }
    }

    const builder = new RealityMeshParamsBuilder({
      initialVertexCapacity: 8,
      initialIndexCapacity: 30,
      positionRange: Range3d.createArray(positions),
    });

    for (let i = 0; i < 8; i++)
      builder.addUnquantizedVertex(positions[i], uvs[i]);

    builder.addQuad(0, 2, 4, 6);
    const  reorder = [0, 2, 6, 4, 0];
    for (let i = 0; i < 4; i++) {
      const iThis = reorder[i], iNext = reorder[i + 1];
      builder.addQuad(iThis, iNext, iThis + 1, iNext + 1);
    }

    return builder.finish();
  }

  /** @internal override */
  public override async readMesh(args: ReadMeshArgs): Promise<RealityMeshParams | undefined> {
    const tile = args.tile;
    if (tile.isPlanar)
      return this._wantSkirts ? this.createSkirtedPlanarMesh(tile) : this.createSkirtlessPlanarMesh(tile);

    return this.createGlobeMesh(tile);
  }

  private createGlobeMesh(tile: MapTile): RealityMeshParams | undefined {
    const globeMeshDimension = 10;
    const projection = tile.getProjection();
    const ellipsoidPatch = projection.ellipsoidPatch;
    assert(undefined !== ellipsoidPatch);
    if (!ellipsoidPatch)
      return undefined;

    const bordersSouthPole = tile.quadId.bordersSouthPole(this._tilingScheme);
    const bordersNorthPole = tile.quadId.bordersNorthPole(this._tilingScheme);

    const range = projection.localRange.clone();
    const delta = 1 / (globeMeshDimension - 3);
    const skirtFraction = delta / 2;

    const dimensionM1 = globeMeshDimension - 1;
    const dimensionM2 = globeMeshDimension - 2;

    ellipsoidPatch.ellipsoid.transformRef.clone(scratchEllipsoid.transformRef);
    const skirtPatch = EllipsoidPatch.createCapture(scratchEllipsoid, ellipsoidPatch.longitudeSweep, ellipsoidPatch.latitudeSweep);
    const scaleFactor = Math.max(0.99, 1 - Math.sin(ellipsoidPatch.longitudeSweep.sweepRadians * delta));
    skirtPatch.ellipsoid.transformRef.matrix.scaleColumnsInPlace(scaleFactor, scaleFactor, scaleFactor);

    const pointCount = globeMeshDimension * globeMeshDimension;
    const rowMin = (bordersNorthPole || this._wantSkirts) ? 0 : 1;
    const rowMax = (bordersSouthPole || this._wantSkirts) ? dimensionM1 : dimensionM2;
    const colMin = this._wantSkirts ? 0 : 1;
    const colMax = this._wantSkirts ? dimensionM1 : dimensionM2;
    const indexCount = 6 * (rowMax - rowMin) * (colMax - colMin);

    const builder = new RealityMeshParamsBuilder({
      positionRange: range,
      initialVertexCapacity: pointCount,
      initialIndexCapacity: indexCount,
    });

    for (let iRow = 0, index = 0; iRow < globeMeshDimension; iRow++) {
      for (let iColumn = 0; iColumn < globeMeshDimension; iColumn++, index++) {
        let u = (iColumn ? (Math.min(dimensionM2, iColumn) - 1) : 0) * delta;
        let v = (iRow ? (Math.min(dimensionM2, iRow) - 1) : 0) * delta;
        scratchPoint2d.set(u, 1 - v);

        if (iRow === 0 || iRow === dimensionM1 || iColumn === 0 || iColumn === dimensionM1) {
          if (bordersSouthPole && iRow === dimensionM1)
            skirtPatch.ellipsoid.radiansToPoint(0, -Angle.piOver2Radians, scratchPoint);
          else if (bordersNorthPole && iRow === 0)
            skirtPatch.ellipsoid.radiansToPoint(0, Angle.piOver2Radians, scratchPoint);
          else {
            u += (iColumn === 0) ? -skirtFraction : (iColumn === dimensionM1 ? skirtFraction : 0);
            v += (iRow === 0) ? -skirtFraction : (iRow === dimensionM1 ? skirtFraction : 0);
            skirtPatch.uvFractionToPoint(u, v, scratchPoint);
          }
        } else {
          projection.getPoint(u, v, 0, scratchPoint);
        }

        builder.addUnquantizedVertex(scratchPoint, scratchPoint2d);
      }
    }

    for (let iRow = rowMin; iRow < rowMax; iRow++) {
      for (let iColumn = colMin; iColumn < colMax; iColumn++) {
        const base = iRow * globeMeshDimension + iColumn;
        const top = base + globeMeshDimension;
        builder.addTriangle(base, base + 1, top);
        builder.addTriangle(top, base + 1, top + 1);
      }
    }

    return builder.finish();
  }

  /** Implements [[TerrainMeshProvider.requestMeshData]] to return an empty string because the mesh can be generated
   * purely from information provided by the [[MapTile]].
   */
  public override async requestMeshData(): Promise<TileRequest.Response> {
    return "";
  }
}
