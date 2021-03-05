/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Numerics
 */
import { ClipPlane } from "../clipping/ClipPlane";
import { ConvexClipPlaneSet } from "../clipping/ConvexClipPlaneSet";
import { AnnounceNumberNumber } from "../curve/CurvePrimitive";
import { Geometry } from "../Geometry";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { PolygonOps } from "../geometry3d/PolygonOps";
import { Range1d, Range3d } from "../geometry3d/Range";
import { Transform } from "../geometry3d/Transform";
import { Map4d } from "./Map4d";
import { Matrix4d } from "./Matrix4d";

/** helper class for managing step-by-step review of a lines.
 * "A" is a previous line.
 * "B" is a new line.
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

// return the LARGER of the NPC distances from point0B, point1B to line A
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
  // install values in the range and return true.
  private setRange1d(range: Range1d, x0: number, x1: number): boolean {
    range.setXXUnordered(x0, x1);
    return true;
  }
  /**
  * * return the fractional interval on line B, such that points in the interval are at a distance minimumDistance or larger
  * * If line B jumps complete between "far negative" and "far positive", only the first fractional part is returned.
  * * If completely inside the minimum, return false but without setting the fractions.
   * @param minimumDistance
   * @param point0B
   * @param point1B
   * @param fractions
   */
  public intervalOfSeparation(minimumDistance: number, point0B: Point3d, point1B: Point3d, fractions: Range1d): boolean {
    if (this.divMagU === undefined)
      return false;
    this.worldToNPC.multiplyPoint3dQuietNormalize(point0B, this.npc0B);
    this.worldToNPC.multiplyPoint3dQuietNormalize(point1B, this.npc1B);
    const d0 = this.signedDistanceToNPCPoint(this.npc0B);
    const d1 = this.signedDistanceToNPCPoint(this.npc1B);
    if (d0 < -minimumDistance) {
      if (d1 < -minimumDistance) {
        return this.setRange1d(fractions, 0, 1);
      } else {
        return this.setRange1d(fractions, 0, Geometry.safeDivideFraction(-minimumDistance - d0, d1 - d0, 0.0));
      }
    } else if (d0 > minimumDistance) {
      if (d1 > minimumDistance) {
        return this.setRange1d(fractions, 0, 1);
      } else {
        return this.setRange1d(fractions, 0.0, Geometry.safeDivideFraction(minimumDistance - d0, d1 - d0, 0.0));
      }
    } else { // d0 starts inside -- may move outside
      if (d1 > minimumDistance) {
        return this.setRange1d(fractions, Geometry.safeDivideFraction(minimumDistance - d0, d1 - d0, 0.0), 1.0);
      } else if (d1 < -minimumDistance) {
        return this.setRange1d(fractions, Geometry.safeDivideFraction(-minimumDistance - d0, d1 - d0, 0.0), 1.0);
      }
      return false;
    }
  }

  public moveLineBToLineA() {
    this.npc0A.set(this.npc0B.x, this.npc0B.y, this.npc0B.z);
    this.npc1A.set(this.npc1B.x, this.npc1B.y, this.npc1B.z);
    this.setupDerivedData();
  }
}
/**
 * ViewGraphicsOps has static members for various viewing-specific computations.
 * @public
 */
export class ViewGraphicsOps {
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
    /**
    // vanishing points?
    //   projective coordinates of 2d lines  . . .
    const npcA = Vector3d.create(npcOrigin.x, npcOrigin.y, npcOrigin.w);
    const npcU = Vector3d.create(npcGridX.x, npcGridX.y, npcGridX.w);
    const npcV = Vector3d.create(npcGridY.x, npcGridY.y, npcGridY.w);
    const npcB = npcA.plus(npcV);
    const crossAU = npcA.crossProduct(npcU);
    const crossBU = npcB.crossProduct(npcU);
    // const crossAV = npcA.crossProduct(npcV);
    const crossVU = npcV.crossProduct(npcU);
    const vanishAU = crossVU.crossProduct(crossAU);
    const vanishBU = crossBU.crossProduct(crossAU);
    */
    // scale up so there are decent size weights.  (Same scale factor
    // weights tend to be really small, so we have to trust that things make sense after division . ...
    const maxWeight = Geometry.maxAbsXYZ(npcOrigin.w, npcGridX.w, npcGridY.w);
    if (maxWeight === 0.0)
      return false;
    const divW = 1.0 / maxWeight;
    npcOrigin.scale(divW, npcOrigin);
    npcGridX.scale(divW, npcGridX);
    npcGridY.scale(divW, npcGridY);

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
    const lineContext = new LineProximityContext(worldToDisplay.transform0);
    const gridPoint0 = Point3d.create();    // to be referenced from both the clip loop body and the lambda function ....
    const gridPoint1 = Point3d.create();
    const clippedGridPoint0 = Point3d.create();
    const clippedGridPoint1 = Point3d.create();
    const xLow = stRange.low.x;
    const xHigh = stRange.high.x;
    const fractionRange = Range1d.createNull();
    let rejected = false;
    let numAnnounced = 0;
    const announceInterval: AnnounceNumberNumber = (f0: number, f1: number) => {
      gridPoint0.interpolate(f0, gridPoint1, clippedGridPoint0);
      gridPoint0.interpolate(f1, gridPoint1, clippedGridPoint1);  // those are in grid line counter space !!!
      const clippedPointWorld0 = gridTransform.multiplyPoint3d(clippedGridPoint0);
      const clippedPointWorld1 = gridTransform.multiplyPoint3d(clippedGridPoint1);

      if (!lineContext.hasValidLine) {
        announceLine(clippedPointWorld0, clippedPointWorld1);
        lineContext.announceLineAWorld(clippedPointWorld0, clippedPointWorld1);
        numAnnounced++;
      } else {
        if (!lineContext.intervalOfSeparation(xyDistanceBetweenLines, clippedPointWorld0, clippedPointWorld1, fractionRange)) {
          rejected = true;
        } else {
          if (fractionRange.isExact01)
            announceLine(clippedPointWorld0, clippedPointWorld1);
          else {
            announceLine(clippedPointWorld0.interpolate(fractionRange.low, clippedPointWorld1),
              clippedPointWorld0.interpolate(fractionRange.high, clippedPointWorld1));
        }
          lineContext.moveLineBToLineA();
          numAnnounced++;

        }
      }
    };
    const iy0 = Math.ceil(stRange.low.y);
    const iy1 = Math.floor(stRange.high.y);
    // sweep bottom up ...
    rejected = false;
    let iy;
    let iyB = iy0;    // will be updated as stopping point for downward sweep
    for (iy = iy0; iy <= iy1; iy++){
      gridPoint0.set(xLow, iy);
      gridPoint1.set(xHigh, iy);
      stClipper.announceClippedSegmentIntervals(0.0, 1.0, gridPoint0, gridPoint1, announceInterval);
      if (rejected) {
        iyB = iy;
        break;
      }
    }

    rejected = false;
    lineContext.invalidateLine();
    for (iy = iy1; iy >=  iyB; iy--){
      gridPoint0.set(xLow, iy);
      gridPoint1.set(xHigh, iy);
      stClipper.announceClippedSegmentIntervals(0.0, 1.0, gridPoint0, gridPoint1, announceInterval);
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
    lineContext.invalidateLine();
    rejected = false;
    for (ix = ix0; ix <= ix1; ix++){
      gridPoint0.set(ix, yLow);
      gridPoint1.set(ix, yHigh);
      stClipper.announceClippedSegmentIntervals(0.0, 1.0, gridPoint0, gridPoint1, announceInterval);
      if (rejected) {
        ixB = ix;
        break;
      }
    }

    // sweep right to left
    rejected = false;
    lineContext.invalidateLine();
    for (ix = ix1; ix >=  ixB; ix--){
      gridPoint0.set(ix, yLow);
      gridPoint1.set(ix, yHigh);
      stClipper.announceClippedSegmentIntervals(0.0, 1.0, gridPoint0, gridPoint1, announceInterval);
      if (rejected)
        break;
    }
    return numAnnounced > 0;
  }
}
