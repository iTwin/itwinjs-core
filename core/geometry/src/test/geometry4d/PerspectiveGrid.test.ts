/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { Geometry } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { Point2d } from "../../geometry3d/Point2dVector2d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Range2d, Range3d } from "../../geometry3d/Range";
import { Transform } from "../../geometry3d/Transform";
import { Map4d } from "../../geometry4d/Map4d";
import { Matrix4d } from "../../geometry4d/Matrix4d";
import { IndexedPolyface } from "../../polyface/Polyface";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { Sample } from "../../serialization/GeometrySamples";
import { Loop } from "../../curve/Loop";
import { ConvexClipPlaneSet } from "../../clipping/ConvexClipPlaneSet";
import { ClipPlane } from "../../clipping/ClipPlane";
import { PolygonOps } from "../../geometry3d/PolygonOps";
import { AnnounceNumberNumber } from "../../curve/CurvePrimitive";
import { ViewGraphicsOps } from "../../geometry4d/ViewGraphicsOps";

function createTransformedUnitBoxMesh(transform: Transform | Matrix4d, z0: number = 0, z1: number = 1): IndexedPolyface {
  const builder = PolyfaceBuilder.create();
  builder.addTransformedRangeMesh(Transform.createIdentity(), Range3d.createXYZXYZ(0, 0, z0, 1, 1, z1),
  //  [true, false, true, false, false, true]
  );
  const mesh = builder.claimPolyface(false);
  if (transform instanceof Transform)
    mesh.data.point.multiplyTransformInPlace(transform);
  else if (transform instanceof Matrix4d) {
    mesh.data.point.multiplyMatrix4dAndQuietRenormalizeMatrix4d (transform);
  }
  mesh.twoSided = true;
  return mesh;
}
function captureXYPlaneGrid(allGeometry: GeometryQuery[], transform: Transform, range: Range2d, xyCounts: Point2d, x0: number, y0: number, z0: number = 0) {
  for (let ix = 0; ix <= xyCounts.x; ix++){
    const f = ix / xyCounts.x;
    const xy0 = range.fractionToPoint(f, 0.0);
    const xy1 = range.fractionToPoint(f, 1.0);
    GeometryCoreTestIO.captureGeometry (allGeometry, LineSegment3d.createCapture(transform.multiplyXYZ(xy0.x, xy0.y, 0),
      transform.multiplyXYZ(xy1.x, xy1.y, 0)), x0, y0, z0);
  }
  for (let iy = 0; iy <= xyCounts.y; iy++){
    const f = iy / xyCounts.y;
    const xy0 = range.fractionToPoint(0.0, f);
    const xy1 = range.fractionToPoint(1.0, f);
    GeometryCoreTestIO.captureGeometry (allGeometry, LineSegment3d.createCapture(transform.multiplyXYZ(xy0.x, xy0.y, 0),
      transform.multiplyXYZ(xy1.x, xy1.y, 0)), x0, y0, z0);
  }
}

describe("PerspectiveGrid", () => {
  it("HelloFrustum", () => {
    const allGeometry: GeometryQuery[] = [];
    const ck = new Checker();
    const unitRange = Range3d.createXYZXYZ(0, 0, 0, 1, 1, 1);
    let x0 = 0;
    let y0 = 0;
    const z0 = 0;
    const cornerY = 80;
    const backSize = 80;
    const gridOccupancyFraction = 0.25;
    const frustumFraction = 0.015;
    for (const gridAngle of [Angle.createDegrees(0), Angle.createDegrees(10), Angle.createDegrees(20), Angle.createDegrees(45),
    Angle.createDegrees (-45)]) {
      x0 = 0;
      for (const zGrid of [0.0, 0.001, 0.01, 0.04, 0.10, 0.40, 0.50, 0.75]) {
        const backLowerLeft = Point3d.create(-0.5 * backSize, cornerY, -0.5 * backSize);
        const eye = Point3d.create(0, -cornerY * frustumFraction / (1 - frustumFraction), 0);
        GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 0, eye, 0.5, x0, y0, z0);
        const lowerEdgeVector = Vector3d.createStartEnd(backLowerLeft, eye).scale(1.0 - frustumFraction);
        const map = Map4d.createVectorFrustum(
            backLowerLeft,
            Vector3d.create(backSize, 0, 0),
          Vector3d.create(0, 0, backSize),
          lowerEdgeVector, frustumFraction)!;
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, createTransformedUnitBoxMesh(map.transform1, 0.0, 0.25), x0, y0, z0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, createTransformedUnitBoxMesh(map.transform1, 0.26, 1.0), x0, y0, z0);
        const gridOrigin = Point3d.create(0, 0, frustumFraction * 0.8 * backLowerLeft.z);   // put the grid center on the front plane below xy plane
        const gridX0 = Vector3d.create(1, 0, 0);
        const gridY0 = Vector3d.create(0, 1, zGrid);
        const cosTheta = gridAngle.cos();
        const sinTheta = gridAngle.sin();
        const gridX = Vector3d.createAdd2Scaled(gridX0, cosTheta, gridY0, sinTheta);
        const gridY = Vector3d.createAdd2Scaled(gridX0, -sinTheta, gridY0, cosTheta);
        const gridZ = gridX.unitCrossProduct(gridY)!;
        const gridTransform = Transform.createOriginAndMatrixColumns(gridOrigin, gridX, gridY, gridZ);
        const gridGeometry: LineSegment3d[] = [];
        const gridExtensionGeometry: LineSegment3d[] = [];
        captureXYPlaneGrid(gridGeometry, gridTransform, Range2d.createXYXY(-10, 0, 10, cornerY * gridOccupancyFraction), Point2d.create(10, 50), 0,0,0);
        captureXYPlaneGrid(gridExtensionGeometry, gridTransform, Range2d.createXYXY(-1, 0, 1, 200), Point2d.create(3, 2), 0,0,0);
        // captureXYPlaneGrid(allGeometry, gridTransform, Range2d.createXYXY(0, 0, 1, 1), Point2d.create(2, 2), x0, y0, z0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, gridGeometry, x0, y0, z0);
        // GeometryCoreTestIO.captureCloneGeometry(allGeometry, gridExtensionGeometry, x0, y0, z0);
        const x0World = x0;
        x0 += 2 * backSize;
        const dxUnit = 2.0;
        const toNPC = map.transform0;
        // promote the grid to 4d . . .
        const npcOrigin = toNPC.multiplyXYZW(gridOrigin.x, gridOrigin.y, gridOrigin.z, 1.0);
        const npcGridX = toNPC.multiplyXYZW(gridX.x, gridX.y, gridX.z, 0.0);
        const npcGridY = toNPC.multiplyXYZW(gridY.x, gridY.y, gridY.z, 0.0);

        const npcGridXDirection = npcGridX.crossWeightedMinus(npcOrigin).normalize ()!;
        const npcGridYDirection = npcGridY.crossWeightedMinus(npcOrigin).normalize()!;
        const npcNormal = npcGridXDirection.unitCrossProduct(npcGridYDirection);
        const npcOriginXYZ = npcOrigin.realPoint();

        const displayableDistance = 0.05;
        if (npcNormal && npcOriginXYZ) {
          const npcPlane = ClipPlane.createNormalAndPoint(npcNormal, npcOriginXYZ)!;
          const npcLoop = npcPlane.intersectRange(unitRange, true)!;
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, npcLoop, x0, y0, z0);
          const xyzLoop = npcLoop.clone();
          xyzLoop.multiplyMatrix4dAndQuietRenormalizeMatrix4d(map.transform1);
          const stLoop = xyzLoop.clone(); // loop coordinates in grid
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, xyzLoop, x0World, y0, z0);
          const gridTransformInverse = gridTransform.inverse()!;
          stLoop.multiplyTransformInPlace(gridTransformInverse);
          const stRange = stLoop.getRange();
          const area = PolygonOps.areaXY(stLoop);
          const stClipper = ConvexClipPlaneSet.createXYPolyLine(stLoop.getPoint3dArray(), undefined, area > 0.0);
          const iy0 = Math.ceil(stRange.low.y);
          const iy1 = Math.floor(stRange.high.y);
          const lineContext = new LineProximityContext(map.transform0);
          const point0 = Point3d.create();    // to be referenced from both the clip loop body and the lambda function ....
          const point1 = Point3d.create();
          const clippedPoint0A = Point3d.create();
          const clippedPoint1A = Point3d.create();
          const clippedPoint0World = Point3d.create();
          const clippedPoint1World = Point3d.create();
          const xLow = stRange.low.x;
          const xHigh = stRange.high.x;
          let rejected = false;
          const announceInterval: AnnounceNumberNumber = (f0: number, f1: number) => {
            point0.interpolate(f0, point1, clippedPoint0A);
            point0.interpolate(f1, point1, clippedPoint1A);  // those are in grid st space !!!
            gridTransform.multiplyPoint3d(clippedPoint0A, clippedPoint0World);
            gridTransform.multiplyPoint3d(clippedPoint1A, clippedPoint1World);

            const xyzSegment = LineSegment3d.create(clippedPoint0World, clippedPoint1World);
            GeometryCoreTestIO.captureGeometry(allGeometry, xyzSegment, x0World, y0, z0);
            if (lineContext.hasValidLine) {
              const d = lineContext.distanceToLine(clippedPoint0World, clippedPoint1World);
              if (d !== undefined && d < displayableDistance)
                rejected = true;
              if (d !== undefined && d > displayableDistance) {
                const npcSegment = LineSegment3d.create(lineContext.npc0B, lineContext.npc1B);
                GeometryCoreTestIO.captureGeometry(allGeometry, npcSegment, x0, y0, z0);
              }
              const npcSegmentB = LineSegment3d.create(lineContext.npc0B, lineContext.npc1B);
              GeometryCoreTestIO.captureGeometry(allGeometry, npcSegmentB, x0 + dxUnit, y0, z0);

              GeometryCoreTestIO.captureCloneGeometry;
              lineContext.moveLineBToLineA();
            } else {
              lineContext.announceLineAWorld(clippedPoint0World, clippedPoint1World);
              }
          };
          // sweep bottom up ...
          rejected = false;
          let iy;
          let iyB = iy0;    // will be updated as stopping point for downward sweep
          for (iy = iy0; iy <= iy1; iy++){
            point0.set(xLow, iy);
            point1.set(xHigh, iy);
            stClipper.announceClippedSegmentIntervals(0.0, 1.0, point0, point1, announceInterval);
            if (rejected) {
              iyB = iy;
              break;
            }
          }

          rejected = false;
          lineContext.invalidateLine();
          for (iy = iy1; iy >=  iyB; iy--){
            point0.set(xLow, iy);
            point1.set(xHigh, iy);
            stClipper.announceClippedSegmentIntervals(0.0, 1.0, point0, point1, announceInterval);
            if (rejected)
              break;
          }

          // sweep left to right
          const ix0 = Math.ceil(stRange.low.x);
          const ix1 = Math.floor(stRange.high.x);
          const yLow = stRange.low.y;
          const yHigh = stRange.high.y;
          let ix;
          let ixB = ix0;    // will be updated as stopping point for downward sweep
          for (ix = ix0; ix <= ix1; ix++){
            point0.set(ix, yLow);
            point1.set(ix, yHigh);
            stClipper.announceClippedSegmentIntervals(0.0, 1.0, point0, point1, announceInterval);
            if (rejected) {
              ixB = ix;
              break;
            }
          }

          // sweep right to left
          rejected = false;
          lineContext.invalidateLine();
          for (ix = ix1; ix >=  ixB; ix--){
            point0.set(ix, yLow);
            point1.set(ix, yHigh);
            stClipper.announceClippedSegmentIntervals(0.0, 1.0, point0, point1, announceInterval);
            if (rejected)
              break;
          }

        }
        // The vanishing line for the grid is all grid s,t points where weight is 0 . . .
        const e = 0.04;
        const npc0Rectangle = Loop.createPolygon(Sample.createRectangleXY(e, e, 1 - e, 1 - e, 0));
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, npc0Rectangle, x0, y0, z0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, npc0Rectangle, x0 + dxUnit, y0, z0);
        // GeometryCoreTestIO.captureCloneGeometry(allGeometry, npcGridGeometry, x0, y0, z0);
        GeometryCoreTestIO.captureRangeEdges(allGeometry, unitRange, x0, y0, z0);
        GeometryCoreTestIO.captureRangeEdges(allGeometry, unitRange, x0 + dxUnit, y0, z0);
        const x0FromFunction = x0 + backSize;
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, createTransformedUnitBoxMesh(map.transform1, 0.0, 1.0), x0FromFunction, y0, z0);
        ViewGraphicsOps.announceGridLinesInView(gridOrigin, gridX, gridY, map, unitRange, displayableDistance,
          (pointA: Point3d, pointB: Point3d) => {
            const segment = LineSegment3d.create(pointA, pointB);
            GeometryCoreTestIO.captureGeometry(allGeometry, segment,
              x0FromFunction, y0, z0);
          });
        x0 += 5 * backSize;
        }
      y0 += 5 * backSize;
      }
    GeometryCoreTestIO.saveGeometry(allGeometry, "PerspectiveGrid", "HelloFrustum");
    expect(ck.getNumErrors()).equals(0);
  });
});
/**
// Return an approximate "distance between line segments" in xy npc space
function projectedXYDistanceLineBToLineA(
  point0A: Point3d, point1A: Point3d,
  point0B: Point3d, point1B: Point3d,
  worldToNPC: Matrix4d
) {
  const npc0A = worldToNPC.multiplyPoint3dQuietNormalize(point0A);
  const npc1A = worldToNPC.multiplyPoint3dQuietNormalize(point1A);
  const npc0B = worldToNPC.multiplyPoint3dQuietNormalize(point0B);
  const npc1B = worldToNPC.multiplyPoint3dQuietNormalize(point1B);
  const dx = npc1A.x - npc0A.x;
  const dy = npc1A.y - npc0A.y;
  const uu = dx * dx + dy * dy;
  const divMagU = Geometry.conditionalDivideCoordinate(1.0, Math.sqrt(uu));
  if (divMagU === undefined)
    return undefined;
  const dx0 = npc0B.x - npc0A.x;
  const dy0 = npc0B.y - npc0A.y;

  const dx1 = npc1B.x - npc0A.x;
  const dy1 = npc1B.y - npc0A.y;
  const cross0 = Geometry.crossProductXYXY(dx, dy, dx0, dy0);
  const cross1 = Geometry.crossProductXYXY(dx, dy, dx1, dy1);
  return Geometry.maxAbsXY(cross0 * divMagU, cross1 * divMagU);
}
*/
/** helper class for managing step-by-step review of a lines.
 * "A" is an
 */
class LineProximityContext {

  public npc0A: Point3d;
  public npc1A: Point3d;
  // edge vector and inverse distance computed from line npc0A to npc1A.
  // undefined divMagU means no line available
  public ux: number;
  public uy: number;
  public divMagU: number | undefined;
// work points for line B
  public npc0B: Point3d;
  public npc1B: Point3d;

  public worldToNPC: Matrix4d;
  public constructor(matrix: Matrix4d) {
    this.ux = this.uy = 0;
    this.divMagU = undefined;
    this.npc0A = Point3d.create();
    this.npc1A = Point3d.create();
    this.npc0B = Point3d.create();
    this.npc1B = Point3d.create();
    this.worldToNPC = matrix.clone();
  }

  public setupDerivedData() {
    this.ux = this.npc1A.x - this.npc0A.x;
    this.uy = this.npc1A.y - this.npc0A.y;
    this.divMagU = Geometry.conditionalDivideCoordinate(1.0, Math.sqrt(this.ux * this.ux + this.uy * this.uy));
  }

/** Capture start and end point of "previous" line. */
  public announceLineAWorld(point0A: Point3d, point1A: Point3d) {
    this.worldToNPC.multiplyPoint3dQuietNormalize(point0A, this.npc0A);
    this.worldToNPC.multiplyPoint3dQuietNormalize(point1A, this.npc1A);
    this.setupDerivedData();
  }

/** Capture start and end point of "previous" line. */
  public invalidateLine() {
    this.ux = 0;
    this.uy = 0;
    this.divMagU = undefined;
  }

  public get hasValidLine(): boolean {
      return this.divMagU !== undefined;
  }

  // ASSUME cached data is valid
  private signedDistanceToNPCPoint(npcPoint: Point3d): number {
    return Geometry.crossProductXYXY(npcPoint.x - this.npc0A.x, npcPoint.y - this.npc0A.y, this.ux, this.uy) * this.divMagU!;
  }

  public distanceToLine(point0B: Point3d, point1B: Point3d): number | undefined{
    if (this.divMagU === undefined)
      return undefined;
      this.worldToNPC.multiplyPoint3dQuietNormalize(point0B, this.npc0B);
    this.worldToNPC.multiplyPoint3dQuietNormalize(point1B, this.npc1B);
    return Geometry.maxAbsXY(
      this.signedDistanceToNPCPoint(this.npc0B),
      this.signedDistanceToNPCPoint(this.npc1B),
    );
  }
  public moveLineBToLineA() {
    this.npc0A.set(this.npc0B.x, this.npc0B.y, this.npc0B.z);
    this.npc1A.set(this.npc1B.x, this.npc1B.y, this.npc1B.z);
    this.setupDerivedData();
  }
}
/**
 * ViewGraphicsOps has static members for various viewing-specific computations.
 */
export class ViewGraphicsOpsTest {
  /**
   * * Emit line segments of a grid that passes through a display volume.
   * * The chosen segments are culled to have a minimum line-to-line distance.
   * * Hence in a perspective view, grid lines that blur together towards the back of the view are not output.
   * * The worldToDisplay map "transform0" matrix is typically one of:
   *    * world to npc -- world space to 0..1 in all directions
   *       * displayRange for this is (0..1)(0..1)(0..1)
   *    * world to pixels -- world space to distinct numX an numY in xy directions, i.e.
   *        * The displayRange for this is (0..numX)(0..numY)(frontZ..backZ)
   *    * in either case, the range "z" values are important as front and back clip depths.
   * @param gridOrigin any point on the grid
   * @param gridXStep  line-to-line x-step vector on the grid
   * @param gridYStep  line to line y-step vector on the grid
   * @param worldToDisplay 4d mapping (invertible) between world and viewed coordinates
   * @param viewRange range of the view after the transformation.
   * @param xyDistanceBetweenLines minimum distance between lines in projected xy space.
   * @param announceLine function to be called to announce each line as it is selected.
   * @returns false if any data is invalid -- e.g. grid vectors parallel.
   */
  public static announceGridLinesInView(
    gridOrigin: Point3d, gridXStep: Vector3d, gridYStep: Vector3d,
    worldToDisplay: Map4d,
    viewRange: Range3d,
    xyDistanceBetweenLines: number,
    announceLine: (pointA: Point3d, pointB: Point3d) => void
  ): boolean {
    const gridZ = gridXStep.unitCrossProduct(gridYStep)!;
    const gridTransform = Transform.createOriginAndMatrixColumns(gridOrigin, gridXStep, gridYStep, gridZ);
    const toNPC = worldToDisplay.transform0;
    // promote the grid to 4d . . .
    const npcOrigin = toNPC.multiplyXYZW(gridOrigin.x, gridOrigin.y, gridOrigin.z, 1.0);
    const npcGridX = toNPC.multiplyXYZW(gridXStep.x, gridXStep.y, gridXStep.z, 0.0);
    const npcGridY = toNPC.multiplyXYZW(gridYStep.x, gridYStep.y, gridYStep.z, 0.0);

    const npcGridXDirection = npcGridX.crossWeightedMinus(npcOrigin).normalize ()!;
    const npcGridYDirection = npcGridY.crossWeightedMinus(npcOrigin).normalize()!;
    const npcNormal = npcGridXDirection.unitCrossProduct(npcGridYDirection);
    const npcOriginXYZ = npcOrigin.realPoint();
    if (npcNormal === undefined || npcOriginXYZ === undefined)
      return false;
    const npcPlane = ClipPlane.createNormalAndPoint(npcNormal, npcOriginXYZ)!;
    const npcLoop = npcPlane.intersectRange(viewRange, true)!;
    const xyzLoop = npcLoop.clone();
    xyzLoop.multiplyMatrix4dAndQuietRenormalizeMatrix4d(worldToDisplay.transform1);
    const stLoop = xyzLoop.clone(); // loop coordinates in grid

    const gridTransformInverse = gridTransform.inverse()!;
    if (gridTransformInverse === undefined)
      return false;
    stLoop.multiplyTransformInPlace(gridTransformInverse);
    const stRange = stLoop.getRange();
    const area = PolygonOps.areaXY(stLoop);
    const stClipper = ConvexClipPlaneSet.createXYPolyLine(stLoop.getPoint3dArray(), undefined, area > 0.0);
    const iy0 = Math.ceil(stRange.low.y);
    const iy1 = Math.floor(stRange.high.y);
    const lineContext = new LineProximityContext(worldToDisplay.transform0);
    const point0 = Point3d.create();    // to be referenced from both the clip loop body and the lambda function ....
    const point1 = Point3d.create();
    const clippedPoint0A = Point3d.create();
    const clippedPoint1A = Point3d.create();
    const clippedPoint0World = Point3d.create();
    const clippedPoint1World = Point3d.create();
    const xLow = stRange.low.x;
    const xHigh = stRange.high.x;
    let rejected = false;
    const announceInterval: AnnounceNumberNumber = (f0: number, f1: number) => {
      point0.interpolate(f0, point1, clippedPoint0A);
      point0.interpolate(f1, point1, clippedPoint1A);  // those are in grid st space !!!
      gridTransform.multiplyPoint3d(clippedPoint0A, clippedPoint0World);
      gridTransform.multiplyPoint3d(clippedPoint1A, clippedPoint1World);

      if (!lineContext.hasValidLine) {
        lineContext.announceLineAWorld(clippedPoint0World, clippedPoint1World);
      } else {
        const d = lineContext.distanceToLine(clippedPoint0World, clippedPoint1World);
        // if d is undefined, we skip quietly
        if (d !== undefined) {
          if (d < xyDistanceBetweenLines)
            rejected = true;
          else {
            announceLine(clippedPoint0World, clippedPoint1World);
            lineContext.moveLineBToLineA();
          }
        }
      }
    };
    // sweep bottom up ...
    rejected = false;
    let iy;
    let iyB = iy0;    // will be updated as stopping point for downward sweep
    for (iy = iy0; iy <= iy1; iy++){
      point0.set(xLow, iy);
      point1.set(xHigh, iy);
      stClipper.announceClippedSegmentIntervals(0.0, 1.0, point0, point1, announceInterval);
      if (rejected) {
        iyB = iy;
        break;
      }
    }

    rejected = false;
    lineContext.invalidateLine();
    for (iy = iy1; iy >=  iyB; iy--){
      point0.set(xLow, iy);
      point1.set(xHigh, iy);
      stClipper.announceClippedSegmentIntervals(0.0, 1.0, point0, point1, announceInterval);
      if (rejected)
        break;
    }

    // sweep left to right
    const ix0 = Math.ceil(stRange.low.x);
    const ix1 = Math.floor(stRange.high.x);
    const yLow = stRange.low.y;
    const yHigh = stRange.high.y;
    let ix;
    let ixB = ix0;    // will be updated as stopping point for downward sweep
    for (ix = ix0; ix <= ix1; ix++){
      point0.set(ix, yLow);
      point1.set(ix, yHigh);
      stClipper.announceClippedSegmentIntervals(0.0, 1.0, point0, point1, announceInterval);
      if (rejected) {
        ixB = ix;
        break;
      }
    }

    // sweep right to left
    rejected = false;
    lineContext.invalidateLine();
    for (ix = ix1; ix >=  ixB; ix--){
      point0.set(ix, yLow);
      point1.set(ix, yHigh);
      stClipper.announceClippedSegmentIntervals(0.0, 1.0, point0, point1, announceInterval);
      if (rejected)
        break;
    }
    return true;
  }
}
