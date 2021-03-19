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
import { GrowableXYZArray } from "../geometry3d/GrowableXYZArray";
import { Plane3dByOriginAndVectors } from "../geometry3d/Plane3dByOriginAndVectors";
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
  /** grid step since previously output line.
   * * 0 is first line
   * * 1 is consecutive lines
   * * 2 or higher means (stepCount - 1) were skipped
   */
  stepCount: number;
}
/**
 * options for grid line constructions
 * @internal
 */
export class ViewportGraphicsGridSpacingOptions {
  /**
   * * 0 ==> output all lines (In this case clipping options is ignored)
   * * 1 ==> output when sufficiently distant from immediate neighbor (measured to immediate neighbor even if neighbor is skipped)
   * * 2 ==> output when sufficiently distant from previously output line (including distance across multiple skipped lines)
   */
  public cullingOption: 0 | 1 | 2;
  /**
   * clipping of each line where it is close to its neighbor.
   * * This option is NOT applied when culling options is 0
   * * 0 ==> output entire line (entire line is clipped by view frustum but not limited by neighbors)
   * * 1 ==> clip line where it is close predecessor line
   */
  public clippingOption: 0 | 1;
  /**
   * distance-between-lines criteria for use when filtering lines.
   * * Units depend on choice of map (view or npc)
   */
  public distanceBetweenLines: number;
  /** Output liens on this multiple of basic grid step.
   * * THIS MUST BE AN INTEGER
   */
  public gridMultiple: number;

  private constructor(distanceBetweenLines: number, cullingOption: 0 | 1 | 2, clippingOption: 0 | 1, gridMultiple: number) {
    this.distanceBetweenLines = distanceBetweenLines;
    this.cullingOption = cullingOption;
    this.clippingOption = clippingOption;
    this.gridMultiple = gridMultiple;
  }
  /**
   * Create a ViewportGraphicsSpacingOptions instance
   * @param distanceBetweenLines  cutoff for decisions about spacing between lines.  In units of the perspective map (npc or pixels)
   * @param cullingOption See ViewportGraphicsGridSpacingOptions
   * @param clippingOption See ViewportGraphicsGridSpacingOptions
   * @param gridMultiple 1 for all grid lines, 10 for every 10th line etc
   */
  public static create(distanceBetweenLines: number, cullingOption: 0 | 1 | 2 = 2, clippingOption: 0 | 1 = 1, gridMultiple = 1) {
    return new ViewportGraphicsGridSpacingOptions(distanceBetweenLines, cullingOption, clippingOption,
    Math.max (1, Math.floor (gridMultiple)));
  }
  /** Return a member-by-member clone */
  public clone(): ViewportGraphicsGridSpacingOptions {
    return new ViewportGraphicsGridSpacingOptions(this.distanceBetweenLines, this.cullingOption, this.clippingOption, this.gridMultiple);
  }
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
   * @param startEndDistance pre-allocated receiver for min and max absolute distance at ends
   */
  public intervalOfSeparation(options: ViewportGraphicsGridSpacingOptions, point0B: Point3d, point1B: Point3d,
    fractions: Range1d,
    perspectiveZStartEnd: Segment1d,
    startEndDistance: Segment1d
  ): boolean {
    if (this.divMagU === undefined)
      return false;
    const minimumDistance = options.distanceBetweenLines;
    this.worldToNPC.multiplyPoint3dQuietNormalize(point0B, this.npc0B);
    this.worldToNPC.multiplyPoint3dQuietNormalize(point1B, this.npc1B);
    const d0 = this.signedDistanceToNPCPoint(this.npc0B);
    const d1 = this.signedDistanceToNPCPoint(this.npc1B);
    startEndDistance.set(d0, d1);
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
/** maximum gridLine index (positive or negative) to consider */
  public static gridRangeMaxXY = 10000.0;
/** maximum gridLine z value to consider -- but the grid is on z=0 so this is not a significant effect */
  public static gridRangeMaxZ = 10000.0;
  /** clamp the range to gridRangeMaxXY */
  public static restrictGridRange(range0: Range3d, refPoint: Point3d | undefined = undefined): Range3d{
    let centerX = 0;
    let centerY = 0;

    if (refPoint !== undefined) {
      centerX = Math.floor(refPoint.x);
      centerY = Math.floor(refPoint.y);
    }
    return range0.intersect(Range3d.createXYZXYZ(
      centerX - this.gridRangeMaxXY, centerY - this.gridRangeMaxXY, -this.gridRangeMaxZ,
      centerX + this.gridRangeMaxXY, centerY + this.gridRangeMaxXY, this.gridRangeMaxZ
    ));
  }
}
/**
 * Context for computing grid lines that are to appear in a view.
 * * Usage pattern
 *   * (One time)       `const context = GridInViewContext.create (...);`
 *   * (multiple calls possible)    ``
 * @internal
 */
export class GridInViewContext {

  private static getRestrictedGridRange(npcLoop: GrowableXYZArray, stLoop: GrowableXYZArray, viewRange: Range3d, _maxLinesInDirection: number): Range3d {
    const stRange1 = stLoop.getRange();   // this might be unreasonably large
    if (npcLoop.length !== stLoop.length)
      return ViewGraphicsOps.restrictGridRange (stRange1);    // This should never happen

    let npcZMax = npcLoop.getZAtUncheckedPointIndex(0);
    let iZMax = 0;
    for (let i = 1; i < npcLoop.length; i++) {
      const z = npcLoop.getZAtUncheckedPointIndex(i);
      if (z > npcZMax) {
        npcZMax = z;
        iZMax = i;
      }
    }
    const stRange = Range3d.create(stLoop.getPoint3dAtCheckedPointIndex(iZMax)!);
    const zTol = 1.0e-8 * viewRange.zLength();
    for (let i = 0; i < npcLoop.length; i++) {
      const z = npcLoop.getZAtUncheckedPointIndex(i);
      if (Math.abs(z - npcZMax) <= zTol) {
        stRange.extend(stLoop.getPoint3dAtCheckedPointIndex(i)!);
      }
    }

    stRange.extendXOnly(Math.min(stRange1.high.x, stRange.high.x + _maxLinesInDirection));
    stRange.extendXOnly(Math.max(stRange1.low.x, stRange.low.x - _maxLinesInDirection));

    stRange.extendYOnly(Math.min(stRange1.high.y, stRange.high.y + _maxLinesInDirection));
    stRange.extendYOnly(Math.max(stRange1.low.y, stRange.low.y - _maxLinesInDirection));
    // Now stRange includes lines that hit the front plane
    return  ViewGraphicsOps.restrictGridRange (stRange, stLoop.getPoint3dAtUncheckedPointIndex (iZMax));
  }
  // REMARK: worldToGrid, gridToWorld, gridByOriginAndVectors, and grid4d are redundant by simplify logic.
  private _worldToDisplay: Map4d;
  private _displayRange: Range3d;
  private _worldToGrid: Transform;
  private _gridToWorld: Transform;
  private _xyzLoop: GrowableXYZArray;
  private _gridByOriginAndVectors: Plane3dByOriginAndVectors;
  private _gridSpaceLoop: GrowableXYZArray;
  // grid range for marching direction
  private _gridSpaceRange: Range3d;
  // grid range for transverse  extent of candidates
  private _gridCandidateRange: Range3d;
  private _gridSpaceClipper: ConvexClipPlaneSet;
  private _lineProximityContext: LineProximityContext;
  /** Return the polygon of intersection between the grid plane and the frustum.
   * * this is a copy of the internal form.
   */
  public get xyzLoop(): Point3d[] { return this._xyzLoop.getPoint3dArray();}
  /**
   * CAPTURE all members.
   */
  private constructor(worldToDisplay: Map4d, displayRange: Range3d,
    gridToWorld: Transform,
    worldToGrid: Transform,
    gridByOriginAndVectors: Plane3dByOriginAndVectors,
    xyzLoop: GrowableXYZArray,
    gridSpaceLoop: GrowableXYZArray,
    gridSpaceRange: Range3d,
    gridCandidateRange: Range3d,
    gridSpaceClipper: ConvexClipPlaneSet,
    lineProximityContext: LineProximityContext
  ) {
    this._worldToDisplay = worldToDisplay;
    this._displayRange = displayRange;
    this._gridByOriginAndVectors = gridByOriginAndVectors;
    this._xyzLoop = xyzLoop;
    this._gridToWorld = gridToWorld;
    this._worldToGrid = worldToGrid;
    this._gridSpaceLoop = gridSpaceLoop;
    this._gridCandidateRange = gridCandidateRange;
    this._gridSpaceRange = gridSpaceRange;
    this._gridSpaceClipper = gridSpaceClipper;
    this._lineProximityContext = lineProximityContext;
  }
  /**
   * Set up a context for given grid and view data.
   * @param gridOrigin
   * @param gridXStep
   * @param gridYStep
   * @param worldToDisplay
   * @param viewRange
   * @param lineCountLimiter
   * @returns
   */
  public static create(
    gridOrigin: Point3d, gridXStep: Vector3d, gridYStep: Vector3d,
    worldToDisplay: Map4d,
    viewRange: Range3d,
    lineCountLimiter: number
  ): GridInViewContext | undefined {
    const gridPlane = Plane3dByOriginAndVectors.createOriginAndVectors(gridOrigin, gridXStep, gridYStep);
    const gridZ = gridXStep.unitCrossProduct(gridYStep)!;
    const gridToWorld = Transform.createOriginAndMatrixColumns(gridOrigin, gridXStep, gridYStep, gridZ);
    const worldToGrid = gridToWorld.inverse();
    if (worldToGrid === undefined)
      return undefined;

    const toNPC = worldToDisplay.transform0;
    // promote the grid to 4d . . .
    const npcOrigin = toNPC.multiplyXYZW(gridOrigin.x, gridOrigin.y, gridOrigin.z, 1.0);
    const npcGridX = toNPC.multiplyXYZW(gridXStep.x, gridXStep.y, gridXStep.z, 0.0);
    const npcGridY = toNPC.multiplyXYZW(gridYStep.x, gridYStep.y, gridYStep.z, 0.0);
    // scale up so there are decent size weights.  (Same scale factor
    // weights tend to be really small, so we have to trust that things make sense after division . ...
    const maxWeight = Geometry.maxAbsXYZ(npcOrigin.w, npcGridX.w, npcGridY.w);
    if (maxWeight === 0.0)
      return undefined;
    const divW = 1.0 / maxWeight;
    npcOrigin.scale(divW, npcOrigin);
    npcGridX.scale(divW, npcGridX);
    npcGridY.scale(divW, npcGridY);

    const npcGridXDirection = npcGridX.crossWeightedMinus(npcOrigin).normalize ()!;
    const npcGridYDirection = npcGridY.crossWeightedMinus(npcOrigin).normalize()!;
    const npcNormal = npcGridXDirection.unitCrossProduct(npcGridYDirection);
    const npcOriginXYZ = npcOrigin.realPoint();

    if (npcNormal === undefined || npcOriginXYZ === undefined)
      return undefined;
    const npcPlane = ClipPlane.createNormalAndPoint(npcNormal, npcOriginXYZ)!;
    const npcLoop = npcPlane.intersectRange(viewRange, true)!;
    if (npcLoop === undefined)
      return undefined;
    const xyzLoop = npcLoop.clone();
    xyzLoop.multiplyMatrix4dAndQuietRenormalizeMatrix4d(worldToDisplay.transform1);
    const gridSpaceLoop = xyzLoop.clone(); // loop coordinates in grid
    gridSpaceLoop.multiplyTransformInPlace(worldToGrid);
    const gridSpaceRange = GridInViewContext.getRestrictedGridRange(npcLoop, gridSpaceLoop, viewRange, lineCountLimiter);
    const gridCandidateRange = gridSpaceLoop.getRange();
    const area = PolygonOps.areaXY(gridSpaceLoop);
    const gridSpaceClipper = ConvexClipPlaneSet.createXYPolyLine(gridSpaceLoop.getPoint3dArray(), undefined, area > 0.0);
    const lineProximityContext = new LineProximityContext(worldToDisplay.transform0);
    return new GridInViewContext(worldToDisplay.clone(), viewRange.clone(), gridToWorld, worldToGrid,
      gridPlane,
      xyzLoop,
      gridSpaceLoop, gridSpaceRange, gridCandidateRange, gridSpaceClipper, lineProximityContext);
  }
/**
 * Process the grid with given options.
 * @param options
 * @param announceLine function to be called with (fully clipped) grid lines.
 * @returns false if invalid setup data or no lines announced.
 */
  public processGrid(
    options: ViewportGraphicsGridSpacingOptions,
    announceLine: (
      /** world coordinates start point of the line */
      pointA: Point3d,
      /** world coordinates end point of the line */
      pointB: Point3d,
      /** depth in view -- the z/w part of the display side of the worldToDisplay transform of pointB.  0 is back, 1 is front */
      perspectiveZA: number | undefined,
      /** depth in view -- the z/w part of the display side of the worldToDisplay transform of pointB.  0 is back, 1 is front */
      perspectiveZB: number | undefined,
      /** distances from A and B to neighbor line.  The same object pointer is passed on all calls -- do not retain the pointer or modify the contents */
      startEndDistance: Segment1d | undefined,
      /** identifies if this is an x or y line, and it's index
       * * NOTE The same instance is updated and passed to each call.
       */
      gridLineIdentifier: ViewportGraphicsGridLineIdentifier
    ) => void
  ): boolean {
    const gridPoint0 = Point3d.create();    // to be referenced from both the clip loop body and the lambda function ....
    const gridPoint1 = Point3d.create();
    const clippedGridPoint0 = Point3d.create();
    const clippedGridPoint1 = Point3d.create();
    const fractionRange = Range1d.createNull();
    const startEndDistance = Segment1d.create();
    const perspectiveZStartEnd = Segment1d.create();
    let numAnnounced = 0;
    const gridLineIdentifier: ViewportGraphicsGridLineIdentifier = { direction: 0, index: 0, stepCount: 0 };
    const lineContext = this._lineProximityContext;

    const announceInterval: AnnounceNumberNumber = (f0: number, f1: number) => {
      gridPoint0.interpolate(f0, gridPoint1, clippedGridPoint0);
      gridPoint0.interpolate(f1, gridPoint1, clippedGridPoint1);  // those are in grid line counter space !!!
      const clippedPointWorld0 = this._gridToWorld.multiplyPoint3d(clippedGridPoint0);
      const clippedPointWorld1 = this._gridToWorld.multiplyPoint3d(clippedGridPoint1);
      // "Every line case " -- still need to know prior line distances
      if (options.cullingOption === 0) {
        if (!lineContext.hasValidLine) {
          lineContext.announceLineAWorld(clippedPointWorld0, clippedPointWorld1, perspectiveZStartEnd);
          gridLineIdentifier.stepCount = 0;
          announceLine(clippedPointWorld0, clippedPointWorld1,
            perspectiveZStartEnd.x0, perspectiveZStartEnd.x1,
            undefined,
            gridLineIdentifier);
        } else {
          gridLineIdentifier.stepCount = 1;
          if (lineContext.intervalOfSeparation(options, clippedPointWorld0, clippedPointWorld1,
            fractionRange, perspectiveZStartEnd, startEndDistance)) {
            announceLine(clippedPointWorld0, clippedPointWorld1,
              perspectiveZStartEnd.x0, perspectiveZStartEnd.x1,
              startEndDistance,
              gridLineIdentifier);
          }
          numAnnounced++;
          return;
        }
      }

      if (!lineContext.hasValidLine) {
        lineContext.announceLineAWorld(clippedPointWorld0, clippedPointWorld1, perspectiveZStartEnd);
        gridLineIdentifier.stepCount = 0;
        announceLine(clippedPointWorld0, clippedPointWorld1,
          perspectiveZStartEnd.x0, perspectiveZStartEnd.x1,
          undefined,
          gridLineIdentifier);
        numAnnounced++;
      } else {
        gridLineIdentifier.stepCount++;
        if (!lineContext.intervalOfSeparation(options, clippedPointWorld0, clippedPointWorld1,
          fractionRange, perspectiveZStartEnd, startEndDistance)) {
          if (options.cullingOption === 1)
            lineContext.moveLineBToLineA();
        } else {
          if (options.clippingOption === 0 || fractionRange.isExact01)
            announceLine(clippedPointWorld0, clippedPointWorld1,
              perspectiveZStartEnd.x0, perspectiveZStartEnd.x1,
              startEndDistance,
              gridLineIdentifier);
          else {
            announceLine(clippedPointWorld0.interpolate(fractionRange.low, clippedPointWorld1),
              clippedPointWorld0.interpolate(fractionRange.high, clippedPointWorld1),
              perspectiveZStartEnd.x0, perspectiveZStartEnd.x1,
              startEndDistance,
              gridLineIdentifier);
          }
          lineContext.moveLineBToLineA();
          gridLineIdentifier.stepCount = 0;
          numAnnounced++;
        }
      }
    };
    const iy0 = Math.ceil(this._gridSpaceRange.low.y);
    const iy1 = Math.floor(this._gridSpaceRange.high.y);
    const xLow = this._gridCandidateRange.low.x;
    const xHigh = this._gridCandidateRange.high.x;
    // sweep bottom up ...
    gridLineIdentifier.direction = 1;
    this._lineProximityContext.invalidateLine();
    for (let iy = iy0; iy <= iy1; iy++){
      if ((iy % options.gridMultiple) !== 0)
        continue;
      gridLineIdentifier.index = iy;
      gridPoint0.set(xLow, iy);
      gridPoint1.set(xHigh, iy);
      this._gridSpaceClipper.announceClippedSegmentIntervals(0.0, 1.0, gridPoint0, gridPoint1, announceInterval);
      }

    // sweep left to right
    const ix0 = Math.ceil(this._gridSpaceRange.low.x);
    const ix1 = Math.floor(this._gridSpaceRange.high.x);
    const yLow = this._gridCandidateRange.low.y;
    const yHigh = this._gridCandidateRange.high.y;
    this._lineProximityContext.invalidateLine();
    gridLineIdentifier.direction = 0;
    for (let ix = ix0; ix <= ix1; ix++){
      if ((ix % options.gridMultiple) !== 0)
        continue;
      gridPoint0.set(ix, yLow);
      gridPoint1.set(ix, yHigh);
      gridLineIdentifier.index = ix;
      this._gridSpaceClipper.announceClippedSegmentIntervals(0.0, 1.0, gridPoint0, gridPoint1, announceInterval);
    }

    return numAnnounced > 0;
  }
}
