/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */

// import { Geometry, Angle, AngleSweep } from "../Geometry";

import { BSplineCurve3d } from "../bspline/BSplineCurve";
import { BSplineCurve3dH } from "../bspline/BSplineCurve3dH";
import { Angle } from "../geometry3d/Angle";
import { NullGeometryHandler } from "../geometry3d/GeometryHandler";
import { Point3d } from "../geometry3d/Point3dVector3d";
import { MomentData } from "../geometry4d/MomentData";
import { Arc3d } from "./Arc3d";
import { CurvePrimitive } from "./CurvePrimitive";
import { AnyRegion } from "./CurveTypes";
import { LineSegment3d } from "./LineSegment3d";
import { LineString3d } from "./LineString3d";
import { Loop } from "./Loop";
import { ParityRegion } from "./ParityRegion";
import { RegionBinaryOpType, RegionOps } from "./RegionOps";
import { TransitionSpiral3d } from "./spiral/TransitionSpiral3d";
import { StrokeOptions } from "./StrokeOptions";
import { UnionRegion } from "./UnionRegion";

/**
 * Implementation class for computing XY area moments.
 * @internal
 */
export class RegionMomentsXY extends NullGeometryHandler {
  private _activeMomentData?: MomentData;
  private _point0 = Point3d.create();
  private _point1 = Point3d.create();
  /**
   * Accumulate (independent) integrations over:
   * * The area between the arc and the chord connecting its endpoints.
   * * The triangle with vertices: origin, arc start, arc end.
   */
  public override handleArc3d(arc: Arc3d): void {
    const momentData = this._activeMomentData!;
    const sweepRadians = arc.sweep.sweepRadians;
    const alphaRadians = sweepRadians * 0.5;
    let s = Math.sin(alphaRadians);
    let c = Math.cos(alphaRadians);
    let s1 = Math.sin(sweepRadians);
    if (Angle.isFullCircleRadians(sweepRadians)) {
      s = 0.0;
      c = -1.0;
      s1 = 0.0;
    }
    const q = 2 * s * s * s * c / (alphaRadians - s * c);
    const s3 = s * s * s;
    const s6 = s3 * s3;
    const area = 0.5 * (sweepRadians - s1);
    const inertiaXX = 0.25 * area * (1.0 - q / 3.0);
    const inertiaYY1 = 0.25 * area * (1.0 + q);
    const inertiaYY = inertiaYY1 - 4.0 * s6 / (9.0 * area);
    const productXX = inertiaYY;
    const productYY = inertiaXX;
    const centerToCentroid = 4.0 * s * s * s / (3.0 * (sweepRadians - s1));
    const midRadians = arc.sweep.fractionToRadians(0.5);
    const centralPlane = arc.radiansToRotatedBasis(midRadians);
    const centroid = centralPlane.origin.plusScaled(centralPlane.vectorU, centerToCentroid);
    momentData.accumulateXYProductsInCentroidalFrame(
      productXX, 0.0, productYY, area, centroid, centralPlane.vectorU, centralPlane.vectorV,
    );
    const pointB = arc.fractionToPoint(0.0);
    const pointC = arc.fractionToPoint(1.0);
    momentData.accumulateTriangleMomentsXY(undefined, pointB, pointC);
  }
  /** Accumulate integrals over the (triangular) areas from the origin to each line segment. */
  public override handleLineString3d(ls: LineString3d): void {
    const momentData = this._activeMomentData!;
    momentData.accumulateTriangleToLineStringMomentsXY(undefined, ls.packedPoints);
  }
  /** Accumulate integrals over the (triangular) area from the origin to this line segment. */
  public override handleLineSegment3d(segment: LineSegment3d): void {
    const momentData = this._activeMomentData!;
    segment.startPoint(this._point0);
    segment.endPoint(this._point1);
    momentData.accumulateTriangleMomentsXY(undefined, this._point0, this._point1);
  }
  /** Accumulate integrals from origin to all primitives in the loop. */
  public override handleLoop(loop: Loop): MomentData | undefined {
    const momentData = this._activeMomentData = MomentData.create();
    momentData.needOrigin = false;
    for (const child of loop.children)
      child.dispatchToGeometryHandler(this);
    this._activeMomentData = undefined;
    return momentData;
  }
  private handleAnyRegion(region: AnyRegion): MomentData | undefined {
    // guarantee there are no overlapping children and parity loops have been properly oriented
    const merged = RegionOps.regionBooleanXY(region, undefined, RegionBinaryOpType.Union);
    if (!merged)
      return undefined;
    if (merged instanceof Loop)
      return this.handleLoop(merged);
    const summedMoments = MomentData.create();
    for (const child of merged.children) {
      const childMoments = child.dispatchToGeometryHandler(this) as MomentData | undefined;
      if (childMoments) {
        // parity region hole sums subtract; all other regions add
        const scale = (merged instanceof ParityRegion && childMoments.quantitySum < 0) ? -1.0 : 1.0;
        const sign0 = childMoments.signFactor(scale);
        summedMoments.accumulateProducts(childMoments, sign0);
      }
    }
    return summedMoments;
  }
  /** Accumulate integrals from origin to the components of the parity region. */
  public override handleParityRegion(region: ParityRegion): MomentData | undefined {
    return this.handleAnyRegion(region);
  }
  /** Accumulate integrals from origin to the components of the union region. */
  public override handleUnionRegion(region: UnionRegion): MomentData | undefined {
    return this.handleAnyRegion(region);
  }

  private _strokeOptions?: StrokeOptions; // TODO: expose to callers in RegionOps
  private getStrokeOptions(): StrokeOptions {
    if (this._strokeOptions)
      return this._strokeOptions;
    const options = StrokeOptions.createForCurves();
    // this is unusually fine for stroking, but appropriate for sum.
    options.angleTol = Angle.createDegrees(5.0);
    this._strokeOptions = options;
    return options;
  }
  /**
   * Handle a single curve primitive (not loop).
   * * Stroke the curve and accumulate stroke array.
   */
  public handleCurvePrimitive(cp: CurvePrimitive): void {
    const strokes = LineString3d.create();
    const options = this.getStrokeOptions();
    cp.emitStrokes(strokes, options);
    this.handleLineString3d(strokes);
  }
  /** Handle strongly typed  BSplineCurve3d  as generic curve primitive. */
  public override handleBSplineCurve3d(g: BSplineCurve3d): void {
    this.handleCurvePrimitive(g);
  }
  /** Handle strongly typed  BSplineCurve3dH  as generic curve primitive. */
  public override handleBSplineCurve3dH(g: BSplineCurve3dH): void {
    this.handleCurvePrimitive(g);
  }
  /** Handle strongly typed  TransitionSpiral as generic curve primitive. */
  public override handleTransitionSpiral(g: TransitionSpiral3d): void {
    this.handleCurvePrimitive(g);
  }
}
