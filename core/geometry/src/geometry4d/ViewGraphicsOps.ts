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
import { Segment1d } from "../geometry3d/Segment1d";
import { Transform } from "../geometry3d/Transform";
import { Map4d } from "./Map4d";
import { Matrix4d } from "./Matrix4d";
/**
 * carrier struct to identify direction and index of a grid line.
 * @internal
 */
export interface ViewportGraphicsGridLineIdentifier {
  /**
   * Identifies a grid line.
   * * Direction 0 is constant x, varying y.
   * * Direction 1 is constant y, varying x.
   */
  direction: 0 | 1;
  /**
   * Grid lines through the grid origin are at index 0.
   */
  index: number;
}
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
  public announceLineAWorld(point0A: Point3d, point1A: Point3d, perspectiveZStartEnd: Segment1d) {
    this.worldToNPC.multiplyPoint3dQuietNormalize(point0A, this.npc0A);
    this.worldToNPC.multiplyPoint3dQuietNormalize(point1A, this.npc1A);
    perspectiveZStartEnd.set(this.npc0A.z, this.npc0B.z);
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
  // x0,x1 are directly installed.
  // interpolated values of (zA, zB) at fraction0 and fraction1 are installed in the zDepths
  private setRanges(range: Range1d, fraction0: number, fraction1: number,
    zDepths: Segment1d, zA: number, zB: number): boolean {

    range.setXXUnordered(fraction0, fraction1);
    zDepths.set(Geometry.interpolate(zA, fraction0, zB), Geometry.interpolate(zA, fraction1, zB));
    return true;
  }

  private static _horizonTrimFraction = 0.90;
  /**
  * * return the fractional interval on line B, such that points in the interval are at a distance minimumDistance or larger
  * * If line B jumps complete between "far negative" and "far positive", only the first fractional part is returned.
  * * If completely inside the minimum, return false but without setting the fractions.
   * @param minimumDistance
   * @param point0B
   * @param point1B
   * @param fractions pre-allocated receiver for fractional interval
   * @param perspectiveZStartEnd pre-allocated receiver for depths at (fractional!) start and end
   */
  public intervalOfSeparation(minimumDistance: number, point0B: Point3d, point1B: Point3d,
    fractions: Range1d,
    perspectiveZStartEnd: Segment1d): boolean {
    if (this.divMagU === undefined)
      return false;

    this.worldToNPC.multiplyPoint3dQuietNormalize(point0B, this.npc0B);
    this.worldToNPC.multiplyPoint3dQuietNormalize(point1B, this.npc1B);
    const d0 = this.signedDistanceToNPCPoint(this.npc0B);
    const d1 = this.signedDistanceToNPCPoint(this.npc1B);
    if (d0 < -minimumDistance) {
      if (d1 < -minimumDistance) {
        return this.setRanges(fractions, 0, 1, perspectiveZStartEnd, this.npc0B.z, this.npc1B.z);
      } else {
        return this.setRanges(fractions, 0, Geometry.safeDivideFraction(-minimumDistance - d0, d1 - d0, 0.0), perspectiveZStartEnd, this.npc0B.z, this.npc1B.z);
      }
    } else if (d0 > minimumDistance) {
      if (d1 > minimumDistance) {
        return this.setRanges(fractions, 0, 1, perspectiveZStartEnd, this.npc0B.z, this.npc1B.z);
      } else {
        return this.setRanges(fractions, 0.0, Geometry.safeDivideFraction(minimumDistance - d0, d1 - d0, 0.0), perspectiveZStartEnd, this.npc0B.z, this.npc1B.z);
      }
    } else { // d0 starts inside -- may move outside
      if (d1 > minimumDistance) {
        return this.setRanges(fractions, Geometry.safeDivideFraction(minimumDistance - d0, d1 - d0, 0.0), 1.0, perspectiveZStartEnd, this.npc0B.z, this.npc1B.z);
      } else if (d1 < -minimumDistance) {
        return this.setRanges(fractions, Geometry.safeDivideFraction(-minimumDistance - d0, d1 - d0, 0.0), 1.0, perspectiveZStartEnd, this.npc0B.z, this.npc1B.z);
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
 * @internal
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
    announceLine: (
      /** world coordinates start point of the line */
      pointA: Point3d,
      /** world coordinates end point of the line */
      pointB: Point3d,
      /** depth in view -- the z/w part of the display side of the worldToDisplay transform of pointB.  0 is back, 1 is front */
      perspectiveZA: number | undefined,
      /** depth in view -- the z/w part of the display side of the worldToDisplay transform of pointB.  0 is back, 1 is front */
      perspectiveZB: number | undefined,
      /** identifies if this is an x or y line, and it's index
       * * NOTE The same instance is updated and passed to each call.
       */
      gridLineIdentifier: ViewportGraphicsGridLineIdentifier
    ) => void
  ): boolean {

    const gridZ = gridXStep.unitCrossProduct(gridYStep)!;
    const gridTransform = Transform.createOriginAndMatrixColumns(gridOrigin, gridXStep, gridYStep, gridZ);
    const toNPC = worldToDisplay.transform0;
    // promote the grid to 4d . . .
    const npcOrigin = toNPC.multiplyXYZW(gridOrigin.x, gridOrigin.y, gridOrigin.z, 1.0);
    const npcGridX = toNPC.multiplyXYZW(gridXStep.x, gridXStep.y, gridXStep.z, 0.0);
    const npcGridY = toNPC.multiplyXYZW(gridYStep.x, gridYStep.y, gridYStep.z, 0.0);
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
    if (npcLoop === undefined)
      return false;
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
    const perspectiveZStartEnd = Segment1d.create();
    let rejected = false;
    let numAnnounced = 0;
    const gridLineIdentifier: ViewportGraphicsGridLineIdentifier = { direction: 0, index: 0 };
    const announceInterval: AnnounceNumberNumber = (f0: number, f1: number) => {
      gridPoint0.interpolate(f0, gridPoint1, clippedGridPoint0);
      gridPoint0.interpolate(f1, gridPoint1, clippedGridPoint1);  // those are in grid line counter space !!!
      const clippedPointWorld0 = gridTransform.multiplyPoint3d(clippedGridPoint0);
      const clippedPointWorld1 = gridTransform.multiplyPoint3d(clippedGridPoint1);

      if (!lineContext.hasValidLine) {
        lineContext.announceLineAWorld(clippedPointWorld0, clippedPointWorld1, perspectiveZStartEnd);
        announceLine(clippedPointWorld0, clippedPointWorld1, perspectiveZStartEnd.x0, perspectiveZStartEnd.x1, gridLineIdentifier);
        numAnnounced++;
      } else {
        if (!lineContext.intervalOfSeparation(xyDistanceBetweenLines, clippedPointWorld0, clippedPointWorld1, fractionRange, perspectiveZStartEnd)) {
          rejected = true;
        } else {
          if (fractionRange.isExact01)
            announceLine(clippedPointWorld0, clippedPointWorld1, perspectiveZStartEnd.x0, perspectiveZStartEnd.x1, gridLineIdentifier);
          else {
            announceLine(clippedPointWorld0.interpolate(fractionRange.low, clippedPointWorld1),
              clippedPointWorld0.interpolate(fractionRange.high, clippedPointWorld1),
              perspectiveZStartEnd.x0, perspectiveZStartEnd.x1, gridLineIdentifier);
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
    gridLineIdentifier.direction = 1;
    for (iy = iy0; iy <= iy1; iy++){
      gridLineIdentifier.index = iy;
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
      gridLineIdentifier.index = iy;
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
    gridLineIdentifier.direction = 0;
    rejected = false;
    for (ix = ix0; ix <= ix1; ix++){
      gridPoint0.set(ix, yLow);
      gridPoint1.set(ix, yHigh);
      gridLineIdentifier.index = ix;
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
