/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Geometry } from "../../Geometry";
import { Point2d } from "../../geometry3d/Point2dVector2d";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Range3d } from "../../geometry3d/Range";
import { IndexedPolyface, Polyface } from "../../polyface/Polyface";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

/* eslint-disable no-console */
/**
 * Context to build a grid with
 * * XY Coordinates are in a grid within specified range.
 * * Z coordinates are initially constant
 * * z values are modified by later directives.
 */
class SampleGridBuilder {
  private _range: Range3d;
  private _numXEdge: number;
  private _numYEdge: number;
  private _data: Point3d[][];
  public constructor(range: Range3d, numXEdge: number, numYEdge: number, initialZ: number) {
    this._numXEdge = Math.max(10, numXEdge);
    this._numYEdge = Math.max(5, numYEdge);
    this._range = range.clone();
    const dx = range.xLength() / this._numXEdge;
    const dy = range.yLength() / this._numYEdge;
    const x0 = range.low.x;
    const y0 = range.low.y;
    this._data = [];
    for (let j = 0; j <= this._numYEdge; j++) {
      const row: Point3d[] = [];
      for (let i = 0; i <= this._numXEdge; i++) {
        row.push(Point3d.create(x0 + i * dx, y0 + j * dy, initialZ));
      }
      this._data.push(row);
    }
  }
  /** Return the closest x index for given x value */
  public closestXIndex(x: number): number {
    return this.closestGridIndex(x, this._range.low.x, this._range.high.x, this._numXEdge);
  }

  /** Return the closest y index for given y value */
  public closestYIndex(y: number): number {
    return this.closestGridIndex(y, this._range.low.y, this._range.high.y, this._numYEdge);
  }
  public closestGridIndex(q: number, q0: number, q1: number, numEdge: number) {
    if (q < q0)
      return 0;
    if (q > q1)
      return numEdge;
    return Math.floor(0.5 + numEdge * (q - q0) / (q1 - q0));
  }
  /**
   * Set grid point z to larger of current and zNew
   * @param i x direction index
   * @param j y direction index
   * @param zNew
   */
  public setGridZToMax(i: number, j: number, zNew: number) {
    if (i >= 0 && i <= this._numXEdge && j >= 0 && j <= this._numYEdge) {
      const point = this._data[j][i];
      point.z = Math.max(point.z, zNew);
    }
  }

  /**
   * * Apply zNew to grid point i,j
   * * for grid points within pyramidDropToZeroCount, apply proportional zNew
   * * pyramidDropToZeroCount === 0,1 are single point max
   * * pyramidDropToZeroCount === 2 gives fractional 1/2 zNew at adjacent grid points.
   * * pyramidDropToZeroCount === 3 gives fractional 2/3 * zNew at adjacent grid points, 1/3*zNew at next layer out.
   * @param i
   * @param j
   * @param zNew
   * @param pyramidDropToZeroCount INTEGER count of grid edges.
   */
  public setGridBlockZToPyramidMax(iMid: number, jMid: number, zNew: number, pyramidDropToZeroCount: number) {
    this.setGridZToMax(iMid, jMid, zNew);
    const n = Math.ceil(pyramidDropToZeroCount);
    if (pyramidDropToZeroCount > 1) {
      for (let j = -n; j <= n; j++) {
        for (let i = -n; i <= n; i++) {
          const k = Math.abs(i) >= Math.abs(j) ? Math.abs(i) : Math.abs(j);
          this.setGridZToMax(iMid + i, jMid + j, zNew * (1.0 - k / pyramidDropToZeroCount));
        }
      }
    }
  }

  /**
   * * Apply zNew to grid point i,j
   * * for grid points within coneRadius, apply proportional zNew
   * @param i
   * @param j
   * @param zNew
   * @param pyramidDropToZeroCount INTEGER count of grid edges.
   */
  public setGridZToConeMax(iMid: number, jMid: number, zNew: number, coneRadius: number) {
    const n = Math.ceil(coneRadius);
    this.setGridZToMax(iMid, jMid, zNew);
    if (n > 1) {
      for (let j = -n; j <= n; j++) {
        for (let i = -n; i <= n; i++) {
          const r = Geometry.hypotenuseXY(i, j);
          if (r < coneRadius)
            this.setGridZToMax(iMid + i, jMid + j, zNew * (1.0 - r / coneRadius));
        }
      }
    }
  }
  /**
   * * Apply zNew to grid point i,j
   * * for grid points within baseRadius, apply cubic (bell-like) falloff
   * @param i
   * @param j
   * @param zNew
   * @param baseRadius radius of base circle
   */
  public setGridZToCubicMax(iMid: number, jMid: number, zNew: number, baseRadius: number) {
    const n = Math.ceil(baseRadius);
    this.setGridZToMax(iMid, jMid, zNew);
    let u, v, f;
    if (n > 1) {
      for (let j = -n; j <= n; j++) {
        for (let i = -n; i <= n; i++) {
          const r = Geometry.hypotenuseXY(i, j);
          if (r < baseRadius) {
            u = r / baseRadius;
            v = 1.0 - u;
            // general cubic bezier on 4 control values a0,a1,a2,a3 is
            // v^3 a0 + 3 v^2 u a1 + 3 v u^2 a2 + u^3 a3
            // here a0 = a1 = 1, a2 = a3 = 0
            f = v * v * (v + 3 * u);
            this.setGridZToMax(iMid + i, jMid + j, zNew * f);
          }
        }
      }
    }
  }

  /**
   * Turn the grid data into a polyface.
   * * param data is (0.5, z) for use in texture mapping.
   */
  public createPolyface(): Polyface {
    const polyface = IndexedPolyface.create(false, true, false);

    const pointIndex: number[][] = [];
    for (let j = 0; j <= this._numYEdge; j++) {
      const indexInRow: number[] = [];
      for (let i = 0; i <= this._numXEdge; i++) {
        const index = polyface.data.point.length;
        const point = this._data[j][i];
        polyface.data.point.push(point);
        polyface.data.param!.push(Point2d.create(0.5, point.z));
        indexInRow.push(index);
      }
      pointIndex.push(indexInRow);
    }
    for (let j0 = 0; j0 < this._numYEdge; j0++) {
      for (let i0 = 0; i0 < this._numXEdge; i0++) {
        const i1 = i0 + 1;
        const j1 = j0 + 1;
        const i00 = pointIndex[j0][i0];
        const i10 = pointIndex[j0][i1];
        const i01 = pointIndex[j1][i0];
        const i11 = pointIndex[j1][i1];
        // lower left triangle
        polyface.data.pointIndex.push(i00);
        polyface.data.pointIndex.push(i10);
        polyface.data.pointIndex.push(i01);
        polyface.data.paramIndex!.push(i00);
        polyface.data.paramIndex!.push(i10);
        polyface.data.paramIndex!.push(i01);

        polyface.data.edgeVisible.push(true);
        polyface.data.edgeVisible.push(true);
        polyface.data.edgeVisible.push(true);
        polyface.terminateFacet();

        // upper right triangle
        polyface.data.pointIndex.push(i10);
        polyface.data.pointIndex.push(i11);
        polyface.data.pointIndex.push(i01);

        polyface.data.paramIndex!.push(i10);
        polyface.data.paramIndex!.push(i11);
        polyface.data.paramIndex!.push(i01);

        polyface.data.edgeVisible.push(true);
        polyface.data.edgeVisible.push(true);
        polyface.data.edgeVisible.push(true);
        polyface.terminateFacet();
      }
    }
    polyface.setNewFaceData();
    return polyface;
  }
}
/** Build a sampled grid with
 * * grid that covers the range of the given points.
 * * numLongDirectionEdge on the longer of the x,y directions
 * * z at grid point is the max over z of all points for which this is the closest grid point.
 * @templateType 1 is pyramid, 2 is cone, else single point.
 */
function buildSampledGrid(points: Point3d[], numLongDirectionEdge: number, templateWidth: number, templateType: number = 0): Polyface {
  const range = Range3d.createArray(points);
  // range.expandInPlace(2.0);
  let numXEdge = numLongDirectionEdge;
  let numYEdge = numLongDirectionEdge;
  if (range.xLength() > range.yLength()) {
    const tileSize = range.xLength() / numXEdge;
    numYEdge = Math.ceil(numLongDirectionEdge * range.yLength() / range.xLength());
    range.high.y = range.low.y + numYEdge * tileSize;
  } else {
    const tileSize = range.yLength() / numXEdge;
    numXEdge = Math.ceil(numLongDirectionEdge * range.xLength() / range.yLength());
    range.high.x = range.low.x + numXEdge * tileSize;
  }
  const grid = new SampleGridBuilder(range, numXEdge, numYEdge, 0.0);
  for (const point of points) {
    const i = grid.closestXIndex(point.x);
    const j = grid.closestYIndex(point.y);
    if (templateType === 3)
      grid.setGridZToCubicMax(i, j, point.z, templateWidth);
    if (templateType === 2)
      grid.setGridZToConeMax(i, j, point.z, templateWidth);
    else if (templateType === 1)
      grid.setGridBlockZToPyramidMax(i, j, point.z, templateWidth);
    else
      grid.setGridZToMax(i, j, point.z);
  }
  return grid.createPolyface();
}
describe("GridSampling", () => {

  it("NearestGridPointMax", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const points = [
      Point3d.create(1, 2, 0.5),
      Point3d.create(7, 2, 0.2),
      Point3d.create(1, 4, 0.2),
      Point3d.create(7, 4, 0.2),
      Point3d.create(6, 8, 0.79),
      Point3d.create(5, 8, 0.79),
      Point3d.create(4, 8, 0.79),
      Point3d.create(4, 7.5, 0.79),
      Point3d.create(4, 7, 0.79),
      Point3d.create(3.5, 7, 0.79),
      Point3d.create(4, 2, 0.80),
      Point3d.create(2, 3, 0.4)];
    const zScale = 2.0;
    for (const p of points)
      p.z *= zScale;

    let x0 = 0.0;
    for (const templateWidth of [0, 2, 3, 4]) {
      const polyface = buildSampledGrid(points, 20, templateWidth, 2);
      GeometryCoreTestIO.captureGeometry(allGeometry, polyface, x0, 0);
      x0 += 10.0;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "GridSampling", "HelloWorld");
    expect(ck.getNumErrors()).equals(0);
  });
  it("Hello5Points", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const points: Point3d[] = [];
    const minX = 1.0;
    const maxX = 10.0;
    const minY = 2.0;
    const maxY = 9.0;
    points.push(Point3d.create(minX, minY, 0.0));
    points.push(Point3d.create(maxX, minY, 0.0));
    points.push(Point3d.create(maxX, maxY, 0.0));
    points.push(Point3d.create(minX, maxY, 0.0));
    points.push(Point3d.create(Geometry.interpolate(minX, 0.75, maxX), Geometry.interpolate(minY, 0.8, maxY), 1.0));

    const pointA = Point3d.create(1.5, 3.0, 0.25);
    const pointB = Point3d.create(6.0, 4.0, 1.0);
    const pointC = Point3d.create(1.5, 7.0, 0.5);
    const step = 1.0 / 32;
    for (let f = 0; f < 1.0; f += step) {
      points.push(pointA.interpolate(f, pointB));
      points.push(pointB.interpolate(f, pointC));
    }
    const zScale = 1.0;
    for (const p of points)
      p.z *= zScale;

    let y0 = 0.0;
    for (const templateType of [1, 2, 3]) {
      let x0 = 0;
      for (const templateWidth of [0, 1.5, 2, 2.5, 3, 4.5]) {
        const polyface = buildSampledGrid(points, 50, templateWidth, templateType);
        GeometryCoreTestIO.captureGeometry(allGeometry, polyface, x0, y0);
        x0 += 20.0;
      }
      y0 += 10.0;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "GridSampling", "Hello5Points");
    expect(ck.getNumErrors()).equals(0);
  });

});
