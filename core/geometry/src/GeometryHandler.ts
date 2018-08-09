/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module ArraysAndInterfaces */

import { CurvePrimitive, CoordinateXYZ } from "./curve/CurvePrimitive";
import { CurveCollection, BagOfCurves, Path, Loop, ParityRegion, UnionRegion } from "./curve/CurveChain";
import { Point3d, Vector3d } from "./PointVector";
import { BSplineCurve3d } from "./bspline/BSplineCurve";
import { BSplineSurface3d, BSplineSurface3dH } from "./bspline/BSplineSurface";
import { IndexedPolyface } from "./polyface/Polyface";
import { Sphere } from "./solid/Sphere";
import { Cone } from "./solid/Cone";
import { Box } from "./solid/Box";
import { TorusPipe } from "./solid/TorusPipe";
import { LinearSweep } from "./solid/LinearSweep";
import { RotationalSweep } from "./solid/RotationalSweep";
import { RuledSweep } from "./solid/RuledSweep";
import { TransitionSpiral3d } from "./curve/TransitionSpiral";

import { LineSegment3d } from "./curve/LineSegment3d";
import { Arc3d } from "./curve/Arc3d";
import { LineString3d } from "./curve/LineString3d";
import { PointString3d } from "./curve/PointString3d";
import { Plane3dByOriginAndVectors } from "./AnalyticGeometry";

export abstract class GeometryHandler {
  // Currently will include functionality on "how to handle" (note: Subclasses of CurveCollection are linked to one method)
  public abstract handleLineSegment3d(g: LineSegment3d): any;
  public abstract handleLineString3d(g: LineString3d): any;
  public abstract handleArc3d(g: Arc3d): any;
  public handleCurveCollection(_g: CurveCollection): any { }
  public abstract handleBSplineCurve3d(g: BSplineCurve3d): any;
  public abstract handleBSplineSurface3d(g: BSplineSurface3d): any;

  public abstract handleCoordinateXYZ(g: CoordinateXYZ): any;
  public abstract handleBSplineSurface3dH(g: BSplineSurface3dH): any;
  public abstract handleIndexedPolyface(g: IndexedPolyface): any;
  public abstract handleTransitionSpiral(g: TransitionSpiral3d): any;

  public handlePath(g: Path): any { return this.handleCurveCollection(g); }
  public handleLoop(g: Loop): any { return this.handleCurveCollection(g); }
  public handleParityRegion(g: ParityRegion): any { return this.handleCurveCollection(g); }
  public handleUnionRegion(g: UnionRegion): any { return this.handleCurveCollection(g); }
  public handleBagOfCurves(g: BagOfCurves): any { return this.handleCurveCollection(g); }

  public abstract handleSphere(g: Sphere): any;
  public abstract handleCone(g: Cone): any;
  public abstract handleBox(g: Box): any;
  public abstract handleTorusPipe(g: TorusPipe): any;
  public abstract handleLinearSweep(g: LinearSweep): any;
  public abstract handleRotationalSweep(g: RotationalSweep): any;
  public abstract handleRuledSweep(g: RuledSweep): any;
  public abstract handlePointString3d(g: PointString3d): any;
}
/**
 * `NullGeometryHandler` is a base class for dispatching various geometry types to
 * appliation specific implementation of some service.
 *
 * To use:
 * * Derive a class from `NullGeometryHandler`
 * * Reimplement any or all of the specific `handleXXXX` methods
 * * Create a handler instance `myHandler`
 * * To send a `GeometryQuery` object `candidateGeometry` through the (fast) dispatch, invoke   `candidateGeometry.dispatchToHandler (myHandler)
 * * The appropriate method or methods will get called with a strongly typed `_g ` value.
 */
export class NullGeometryHandler extends GeometryHandler {
  public handleLineSegment3d(_g: LineSegment3d): any { return undefined; }
  public handleLineString3d(_g: LineString3d): any { return undefined; }
  public handleArc3d(_g: Arc3d): any { return undefined; }
  public handleCurveCollection(_g: CurveCollection): any { return undefined; }
  public handleBSplineCurve3d(_g: BSplineCurve3d): any { return undefined; }
  public handleBSplineSurface3d(_g: BSplineSurface3d): any { return undefined; }

  public handleCoordinateXYZ(_g: CoordinateXYZ): any { return undefined; }
  public handleBSplineSurface3dH(_g: BSplineSurface3dH): any { return undefined; }
  public handleIndexedPolyface(_g: IndexedPolyface): any { return undefined; }
  public handleTransitionSpiral(_g: TransitionSpiral3d): any { return undefined; }

  public handlePath(_g: Path): any { return undefined; }
  public handleLoop(_g: Loop): any { return undefined; }
  public handleParityRegion(_g: ParityRegion): any { return undefined; }
  public handleUnionRegion(_g: UnionRegion): any { return undefined; }
  public handleBagOfCurves(_g: BagOfCurves): any { return undefined; }

  public handleSphere(_g: Sphere): any { return undefined; }
  public handleCone(_g: Cone): any { return undefined; }
  public handleBox(_g: Box): any { return undefined; }
  public handleTorusPipe(_g: TorusPipe): any { return undefined; }
  public handleLinearSweep(_g: LinearSweep): any { return undefined; }
  public handleRotationalSweep(_g: RotationalSweep): any { return undefined; }
  public handleRuledSweep(_g: RuledSweep): any { return undefined; }
  public handlePointString3d(_g: PointString3d): any { return undefined; }
}
/** IStrokeHandler is an interface with methods to receive data about curves being stroked.
 * CurvePrimitives emitStrokes () methods emit calls to a handler object with these methods.
 * The various CurvePrimitive types are free to announce either single points (announcePoint), linear fragments,
 * or fractional intervals of the parent curve.
 *
 * * handler.startCurvePrimitive (cp) -- announce the curve primitive whose strokes will follow.
 * * announcePointTangent (xyz, fraction, tangent) -- annunce a single point on the curve.
 * * announceIntervalForUniformStepStrokes (cp, numStrokes, fraction0, fraction1) -- announce a fraction
 * interval in which the curve can be evaluated (e.g. the handler can call cp->fractionToPointAndDerivative ())
 * * announceSegmentInterval (cp, point0, point1, numStrokes, fraction0, fraction1) -- announce
 *    that the fractional interval fraction0, fraction1 is a straight line which should be broken into
 *    numStrokes strokes.
 *
 * ** A LineSegment would make a single call to this.
 * ** A LineString would make one call to this for each of its segments, with fractions indicating position
 * within the linestring.
 * * endCurvePrimitive (cp) -- announce the end of the curve primitive.
 *
 */
export interface IStrokeHandler {
  /** announce a parent curve primitive
   * * startParentCurvePrimitive() ...endParentCurvePrimitive() are wrapped around startCurvePrimitive and endCurvePrimitive when the interior primitive is a proxy.
   */
  startParentCurvePrimitive(cp: CurvePrimitive): void;
  startCurvePrimitive(cp: CurvePrimitive): void;
  // remark ... point and tangent data is to be cloned !!!
  announcePointTangent(xyz: Point3d, fraction: number, tangent: Vector3d): void;

  /** Announce that curve primitive cp should be evaluated in the specified fraction interval. */
  announceIntervalForUniformStepStrokes(
    cp: CurvePrimitive,
    numStrokes: number,
    fraction0: number,
    fraction1: number): void;
  /** Announce numPoints interpolated between point0 and point1, with associated fractions */
  announceSegmentInterval(
    cp: CurvePrimitive,
    point0: Point3d,
    point1: Point3d,
    numStrokes: number,
    fraction0: number,
    fraction1: number): void;
  endCurvePrimitive(cp: CurvePrimitive): void;
  endParentCurvePrimitive(cp: CurvePrimitive): void;
}
/**
 * Interface with methods for mapping (u,v) fractional coordinates to surface xyz and derivatives.
 */
export interface UVSurface {
  /**
   * Convert fractional u and v coordinates to surface point
   * @param uFraction fractional coordinate in u direction
   * @param vFraction fractional coordinate in the v direction
   * @param result optional pre-allocated point
   */
  UVFractionToPoint(uFraction: number, vFraction: number, result?: Point3d): Point3d;
  /**
   * Convert fractional u and v coordinates to surface point and partial derivatives
   * @param uFraction fractional coordinate in u direction
   * @param vFraction fractional coordinate in the v direction
   * @param result optional pre-allocated carrier for point and vectors
   */
  UVFractionToPointAndTangents(uFraction: number, vFraction: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors;
}
