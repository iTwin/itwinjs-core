/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Curve
 */

import { Geometry } from "../../Geometry";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Ray3d } from "../../geometry3d/Ray3d";
import { Arc3d } from "../Arc3d";
import { CurveChain, CurveCollection } from "../CurveCollection";
import { CurveCurve } from "../CurveCurve";
import { CurveCurveApproachType, CurveLocationDetailPair } from "../CurveLocationDetail";
import { CurvePrimitive } from "../CurvePrimitive";
import { LineSegment3d } from "../LineSegment3d";
import { LineString3d } from "../LineString3d";
import { Loop } from "../Loop";
import { JointOptions, OffsetOptions } from "../OffsetOptions";
import { Path } from "../Path";
import { RegionOps } from "../RegionOps";

// cspell:word CCWXY

/**
 * Classification of how the joint is constructed.
 * @internal
 */
enum JointMode {
  Unknown = 0, /** used when joint mode is unknown. */
  Cap = 1, /** used to annotate a "Joint" at the start/end of a curve without wrap (so there's no "other" curve). */
  Extend = 2, /** used when offset curves do not intersect and needs expanding to connect. */
  Trim = -1, /** used when offset curves intersect and still goes beyond the intersection so need trimming. */
  JustGeometry = 3, /** unused */
  Gap = 4, /** used when joint construction fails, resulting in a gap in the offset filled by a line segment. */
}

/**
 * Description of geometry around a joint.
 * @internal
 */
class Joint {
  /** Enumeration of how the joint is constructed */
  public flexure: JointMode;
  /** Curve before the joint */
  public curve0?: CurvePrimitive;
  /** Fractional position on curve0 (may be a trim or extension) */
  public fraction0?: number;
  /** Curve after the joint (may be a trim or extension) */
  public curve1?: CurvePrimitive;
  /** Fractional position on curve1 */
  public fraction1?: number;
  /** Curve to be added within the joint */
  public jointCurve?: CurvePrimitive;
  /** Common point on the original curves */
  public swingPoint?: Point3d;
  /** Pointer to next joint */
  public nextJoint?: Joint;
  /** Pointer to previous joint */
  public previousJoint?: Joint;
  // capture references to all data . . .
  public constructor(
    curve0: CurvePrimitive | undefined, curve1: CurvePrimitive | undefined, swingPoint: Point3d | undefined,
  ) {
    this.curve0 = curve0;
    this.curve1 = curve1;
    this.swingPoint = swingPoint;
    this.flexure = JointMode.Unknown;
  }
  /**
   * Try to construct an arc transition from ray0 to ray1 with given center.
   */
  public static constructArc(ray0: Ray3d, center: Point3d | undefined, ray1: Ray3d): Arc3d | undefined {
    if (center !== undefined && Geometry.isSameCoordinate(ray0.origin.distance(center), ray1.origin.distance(center))) {
      const angle = ray0.direction.angleToXY(ray1.direction);
      const vector0 = Vector3d.createStartEnd(center, ray0.origin);
      const vector90 = vector0.rotate90CCWXY();
      return Arc3d.create(center, vector0, vector90, AngleSweep.createStartEndRadians(0.0, angle.radians));
    }
    return undefined;
  }
  /** Extract a json object of {curve0:data, fraction0:data, curve1:data, fraction1:data} */
  public shallowExtract(): any {
    return { curve0: this.curve0, curve1: this.curve1, fraction0: this.fraction0, fraction1: this.fraction1 };
  }
  /** Establish the nextJoint and previousJoint links from joint0 to joint1. */
  public static link(joint0: Joint, joint1: Joint | undefined) {
    joint0.nextJoint = joint1;
    if (joint1)
      joint1.previousJoint = joint0;
    if (joint0.curve1 && joint1 && !joint1.curve0)
      joint1.curve0 = joint0.curve1;
    else if (!joint0.curve1 && joint1 && joint1.curve0)
      joint0.curve1 = joint1.curve0;
  }
  /**
   * * If nextJoint and nextJoint.fraction0 are defined, return them.
   * * Otherwise return defaultValue
   */
  public nextJointFraction0(defaultValue: number): number {
    if (this.nextJoint && this.nextJoint.fraction0 !== undefined)
      return this.nextJoint.fraction0;
    return defaultValue;
  }
  private static addStrokes(destination: LineString3d, curve?: CurvePrimitive) {
    if (curve) {
      curve.emitStrokes(destination);
    }
  }
  private static addPoint(destination: LineString3d, point: Point3d) {
    if (destination.packedPoints.length > 0) {
      const pointA = destination.endPoint();
      if (!pointA.isAlmostEqual(point))
        destination.packedPoints.push(point);
    }
  }
  /** Append stroke points along the offset curve defined by the Joint chain to the destination line string. */
  public static collectStrokesFromChain(start: Joint, destination: LineString3d, maxTest: number = 100) {
    let numOut = -2 * maxTest; // allow extra things to happen
    Joint.visitJointsOnChain(
      start,
      (joint: Joint) => {
        this.addStrokes(destination, joint.jointCurve);
        if (joint.curve1 && joint.fraction1 !== undefined) {
          const fA = joint.fraction1;
          const fB = joint.nextJointFraction0(1.0);
          let curve1;
          if (fA === 0.0 && fB === 1.0)
            curve1 = joint.curve1.clone();
          else if (fA < fB)
            curve1 = joint.curve1.clonePartialCurve(fA, fB); // trimming is done by clonePartialCurve
          if (curve1) {
            if (!joint.jointCurve) {
              this.addPoint(destination, curve1.startPoint());
            }
          }
          this.addStrokes(destination, curve1);
        }
        return numOut++ < maxTest;
      },
      maxTest,
    );
  }
  private static collectPrimitive(destination: CurvePrimitive[], primitive?: CurvePrimitive) {
    if (primitive) {
      if (destination.length > 0) {
        const pointA = destination[destination.length - 1].endPoint();
        const pointB = primitive.startPoint();
        if (!pointA.isAlmostEqual(pointB)) {
          destination.push(LineSegment3d.create(pointA, pointB));
        }
      }
      destination.push(primitive);
    }
  }
  private static adjustJointToPrimitives(joint: Joint) {
    const ls = joint.jointCurve;
    if (ls instanceof LineString3d) {
      if (joint.curve0) {
        const curvePoint = joint.curve0.endPoint();
        const jointPoint0 = ls.startPoint();
        if (!curvePoint.isAlmostEqual(jointPoint0))
          ls.packedPoints.setAtCheckedPointIndex(0, curvePoint);
      }
      if (joint.curve1) {
        const curvePoint = joint.curve1.startPoint();
        const jointPoint1 = ls.endPoint();
        if (!curvePoint.isAlmostEqual(jointPoint1))
          ls.packedPoints.setAtCheckedPointIndex(ls.packedPoints.length - 1, curvePoint);
      }
    }
  }
  /** Append CurvePrimitives along the offset curve defined by the Joint chain to the destination array. */
  public static collectCurvesFromChain(start: Joint | undefined, destination: CurvePrimitive[], maxTest: number = 100) {
    if (start === undefined)
      return;
    let numOut = -2 * maxTest; // allow extra things to happen
    Joint.visitJointsOnChain(
      start,
      (joint: Joint) => {
        this.adjustJointToPrimitives(joint);
        this.collectPrimitive(destination, joint.jointCurve);

        if (joint.curve1 && joint.fraction1 !== undefined) {
          const fA = joint.fraction1;
          const fB = joint.nextJointFraction0(1.0);
          let curve1;
          if (fA === 0.0 && fB === 1.0)
            curve1 = joint.curve1.clone();
          else if (fA < fB)
            curve1 = joint.curve1.clonePartialCurve(fA, fB); // trimming is done by clonePartialCurve
          this.collectPrimitive(destination, curve1);
        }
        return numOut++ < maxTest;
      },
      maxTest,
    );
  }
  /**
   * Execute `joint.annotateJointMode()` at all joints on the chain to set some of the joints' attributes,
   * such as whether to extend both curves to intersection or to fill the gap between curves.
   */
  public static annotateChain(start: Joint | undefined, options: JointOptions, maxTest: number = 100) {
    if (start)
      Joint.visitJointsOnChain(start, (joint: Joint) => { joint.annotateJointMode(options); return true; }, maxTest);
  }
  /**
   * Visit joints on a chain.
   * * terminate on `false` return from `callback`
   * @param start first (and, for cyclic chain, final) joint
   * @param callback function to call with each Joint as a single parameter.
   */
  public static visitJointsOnChain(start: Joint, callback: (joint: Joint) => boolean, maxTest: number = 100): boolean {
    let joint: Joint | undefined = start;
    if (joint) {
      let numTest = 0;
      while (joint !== undefined) {
        if (numTest++ >= maxTest + 5) // allow extra things to happen
          return true;
        if (!callback(joint))
          return false;
        joint = joint.nextJoint;
        if (joint === start)
          break;
      }
    }
    return true;
  }
  /** NOTE: no assumption on type of curve0, curve1 */
  private annotateExtension(options: JointOptions) {
    if (this.curve0 && this.curve1) {
      const ray0 = this.curve0.fractionToPointAndDerivative(1.0);
      const ray1 = this.curve1.fractionToPointAndDerivative(0.0);
      ray0.direction.z = ray1.direction.z = 0.0;  // xy-offset
      const intersection = Ray3d.closestApproachRay3dRay3d(ray0, ray1); // intersection of the 2 ray lines
      if (intersection.approachType === CurveCurveApproachType.Intersection) {
        if (intersection.detailA.fraction >= 0.0 && intersection.detailB.fraction <= 0.0) {
          this.fraction0 = 1.0;
          this.fraction1 = 0.0;
          this.flexure = JointMode.Extend;
          const theta = ray0.getDirectionRef().angleToXY(ray1.getDirectionRef()); // angle between the 2 ray lines
          if (options.needArc(theta)) {
            const arc = Joint.constructArc(ray0, (this.curve0 as any).baseCurveEnd, ray1);
            if (arc) {
              this.jointCurve = arc;
              return;
            }
          }
          const numChamferPoints = options.numChamferPoints(theta); // how many interior points in the linestring
          if (numChamferPoints <= 1) { // create sharp corner
            this.jointCurve = LineString3d.create(ray0.origin, intersection.detailA.point, ray1.origin);
            return;
          }
          if (numChamferPoints > 1) { // create chamfer corner (a line string)
            const radians0 = theta.radians;
            const numHalfStep = 2.0 * numChamferPoints;
            const halfStepRadians = radians0 / numHalfStep;
            const arc = Joint.constructArc(ray0, (this.curve0 as any).baseCurveEnd, ray1);
            if (arc !== undefined) {
              const radialFraction = 1 / Math.cos(halfStepRadians);
              const jointCurve = LineString3d.create();
              this.jointCurve = jointCurve;
              jointCurve.addPoint(ray0.origin); // possibly extend segment or line string

              for (let i = 0; i < numChamferPoints; i++) {
                const arcFraction = (1 + 2 * i) / numHalfStep;
                jointCurve.addPoint(arc.fractionAndRadialFractionToPoint(arcFraction, radialFraction));
              }
              jointCurve.addPoint(ray1.origin); // possibly extend segment or line string.
              return;
            }
          }
        }
      }
      // if there is no intersection between the 2 ray lines, fill the gap by a line segment
      this.flexure = JointMode.Gap;
      this.jointCurve = LineSegment3d.create(this.curve0.fractionToPoint(1.0), this.curve1.fractionToPoint(0.0));
      this.fraction0 = 1.0;
      this.fraction1 = 0.0;
    }
  }
  /** Select the index at which summed fraction difference is smallest */
  private selectIntersectionIndexByFraction(
    fractionA: number, fractionB: number, intersections: CurveLocationDetailPair[],
  ): number {
    let index = -1;
    let aMin = Number.MAX_VALUE;
    for (let i = 0; i < intersections.length; i++) {
      const a = Math.abs(intersections[i].detailA.fraction - fractionA)
        + Math.abs(intersections[i].detailB.fraction - fractionB);
      if (a < aMin) {
        aMin = a;
        index = i;
      }
    }
    return index;
  }
  /**
   * Examine the adjacent geometry to set some of joint attributes:
   * * set JointMode: one of Cap, Extend, or Trim
   * * set fraction0 and fraction1 of intersection of curve0 and curve1
   * * set joint curve
   * * this REFERENCES curve0, curve1, fraction0, fraction1
   * * this does not reference nextJoint and previousJoint
   */
  public annotateJointMode(options: JointOptions): void {
    if (!this.curve0 && this.curve1) { // joint at the start of the chain
      this.flexure = JointMode.Cap;
      this.fraction1 = 0.0;
    } else if (this.curve0 && !this.curve1) { // joint at the end of the chain
      this.flexure = JointMode.Cap;
      this.fraction0 = 1.0;
    } else if (this.curve0 && this.curve1) { // joints at the middle of the chain
      if (this.curve0.endPoint().isAlmostEqualXY(this.curve1.startPoint())) { // joint between colinear xy-segments
        this.fraction0 = 1.0;
        this.fraction1 = 0.0;
        this.flexure = JointMode.Trim;
      } else if (this.curve0 instanceof LineSegment3d && this.curve1 instanceof LineSegment3d) { // pair of lines
        const ray0 = this.curve0.fractionToPointAndDerivative(0.0);
        const ray1 = this.curve1.fractionToPointAndDerivative(0.0);
        ray0.direction.z = ray1.direction.z = 0.0;  // xy-offset
        const intersection = Ray3d.closestApproachRay3dRay3d(ray0, ray1); // intersection of the 2 ray lines
        if (intersection.approachType === CurveCurveApproachType.Intersection || intersection.approachType === CurveCurveApproachType.PerpendicularChord) {
          this.fraction0 = intersection.detailA.fraction;
          this.fraction1 = intersection.detailB.fraction;
          if (this.fraction0 >= 1.0 && this.fraction1 <= 0.0) { // need to extend
            this.annotateExtension(options);
          } else if (this.fraction0 < 1.0 && this.fraction1 > 0.0) { // need to trim
            this.flexure = JointMode.Trim;
          } else if (this.fraction0 > 1.0 && this.fraction1 > 1.0) { // need to fill gap with a single line segment
            this.flexure = JointMode.Gap;
            this.jointCurve = LineSegment3d.create(this.curve0.fractionToPoint(1.0), this.curve1.fractionToPoint(0.0));
            this.fraction0 = 1.0;
            this.fraction1 = 0.0;
          }
        }
      } else { // generic pair of curves
        const intersections = CurveCurve.intersectionXYPairs(this.curve0, false, this.curve1, false);
        const intersectionIndex = this.selectIntersectionIndexByFraction(1.0, 0.0, intersections);
        if (intersectionIndex >= 0) { // need to trim
          this.flexure = JointMode.Trim;
          this.fraction0 = intersections[intersectionIndex].detailA.fraction;
          this.fraction1 = intersections[intersectionIndex].detailB.fraction;
        } else { // need to extend
          this.annotateExtension(options);
        }
      }
    }
  }
  /**
   * * Examine the primitive trim fractions between each pair of joints.
   * * If trim fractions indicate the primitive must disappear, replace the joint pair by a new joint pointing at
   * surrounding primitives
   * @param start
   */
  public static removeDegeneratePrimitives(
    start: Joint, options: JointOptions, maxTest: number,
  ): { newStart: Joint, numJointRemoved: number } {
    /*
    if (Checker.noisy.PolygonOffset)
      GeometryCoreTestIO.consoleLog("\nENTER removeDegenerates");
    */
    let jointA: Joint | undefined = start;
    let numRemoved = 0;
    const maxRemove = 1;
    let numTest = 0;
    if (jointA) {
      while (jointA !== undefined && numTest++ < maxTest) {
        const jointB = jointA.nextJoint;
        if (jointA
          && jointB
          && jointA.previousJoint
          && jointB.nextJoint
          && jointA.fraction1 !== undefined
          && jointB.fraction0 !== undefined
        ) {
          const f0 = jointA.fraction1;
          const f1 = jointB.fraction0;
          const g0 = jointB.fraction1;
          const g1 = jointB.nextJoint.fraction0;
          // f0 and f1 are fractions on the single primitive between these joints.
          /*
            if (Checker.noisy.PolygonOffset) {
              GeometryCoreTestIO.consoleLog("joint candidate");
              GeometryCoreTestIO.consoleLog(prettyPrint(jointA.shallowExtract()));
              GeometryCoreTestIO.consoleLog(prettyPrint(jointB.shallowExtract()));
              GeometryCoreTestIO.consoleLog("FRACTIONS ", { fA1: f0, fB0: f1 });
            }
          */
          const eliminateF = f0 >= f1 || f0 > 1.0;
          const eliminateG = (g0 !== undefined && g0 > 1.0) || (g0 !== undefined && g1 !== undefined && g0 >= g1);
          if (eliminateF && eliminateG) {
            const jointC = jointB.nextJoint;
            const newJoint: Joint = new Joint(jointA.curve0, jointC.curve1, undefined);
            Joint.link(jointA.previousJoint, newJoint);
            Joint.link(newJoint, jointC.nextJoint);
            newJoint.annotateJointMode(options);
            newJoint.previousJoint!.annotateJointMode(options);
            if (newJoint.nextJoint)
              newJoint.nextJoint.annotateJointMode(options);
            /*
            if (Checker.noisy.PolygonOffset) {
              GeometryCoreTestIO.consoleLog(" NEW DOUBLE CUT");
              GeometryCoreTestIO.consoleLog(prettyPrint(newJoint.shallowExtract()));
            }
            */
          } else if (eliminateF) {
            const newJoint: Joint = new Joint(jointA.curve0, jointB.curve1, undefined);
            Joint.link(jointA.previousJoint, newJoint);
            Joint.link(newJoint, jointB.nextJoint);
            newJoint.annotateJointMode(options);
            newJoint.previousJoint!.annotateJointMode(options);
            newJoint.nextJoint!.annotateJointMode(options);
            /*
            if (Checker.noisy.PolygonOffset) {
              GeometryCoreTestIO.consoleLog(" NEW JOINT");
              GeometryCoreTestIO.consoleLog(prettyPrint(newJoint.shallowExtract()));
            }
          */
            numRemoved++;
            if (jointA === start)
              start = newJoint;
            jointA = newJoint;
            if (numRemoved >= maxRemove) {
              /*
              if (Checker.noisy.PolygonOffset)
                GeometryCoreTestIO.consoleLog(" EXIT removeDegenerates at maxRemove\n");
              */
              return { newStart: start, numJointRemoved: numRemoved };
            }
          }
        }
        jointA = jointA.nextJoint;
        if (jointA === start)
          break;
      }
    }
    return { newStart: start, numJointRemoved: numRemoved };
  }
}

/**
 * Context for building a wire xy-offset.
 * @internal
 */
export class PolygonWireOffsetContext {
  /** Construct a context. */
  public constructor() { }
  private static _unitAlong = Vector3d.create();
  private static _unitPerp = Vector3d.create();
  private static _offsetA = Point3d.create();
  private static _offsetB = Point3d.create();
  // Construct a single offset from base points
  private static createOffsetSegment(
    basePointA: Point3d, basePointB: Point3d, distance: number,
  ): CurvePrimitive | undefined {
    Vector3d.createStartEnd(basePointA, basePointB, this._unitAlong);
    this._unitAlong.z = 0.0;  // xy-offset
    if (this._unitAlong.normalizeInPlace()) {
      this._unitAlong.rotate90CCWXY(this._unitPerp);
      const segment = LineSegment3d.create(
        basePointA.plusScaled(this._unitPerp, distance, this._offsetA),
        basePointB.plusScaled(this._unitPerp, distance, this._offsetB),
      );
      CurveChainWireOffsetContext.applyBasePoints(segment, basePointA.clone(), basePointB.clone());
      return segment;
    }
    return undefined;
  }
  /**
   * Construct a wire (not area) that is offset from given polyline or polygon.
   * * For best results, points should be in a horizontal plane because z-coordinates are ignored.
   * * This is a simple wire offset (in the form of a line string), not an area.
   * * If offsetDistance is given as a number, default OffsetOptions are applied.
   * * See [[JointOptions]] class doc for offset construction rules.
   * @param points a single loop or path
   * @param wrap true to offset the wraparound joint. Assumes first = last point.
   * @param offsetDistanceOrOptions offset distance (positive to left of curve, negative to right) or JointOptions
   * object.
   */
  public constructPolygonWireXYOffset(
    points: Point3d[], wrap: boolean, leftOffsetDistanceOrOptions: number | JointOptions,
  ): CurveChain | undefined {
    if (wrap && !points[0].isAlmostEqual(points[points.length - 1]))
      wrap = false; // no wrap possible for polylines
    // create raw offset segments as a linked list of Joints, starting with joint0
    const options = JointOptions.create(leftOffsetDistanceOrOptions);
    const numPoints = points.length;
    let fragment0: CurvePrimitive | undefined;
    let joint0, previousJoint: Joint | undefined;
    for (let i = 0; i + 1 < numPoints; ++i) {
      if (!previousJoint) { // start the linked list at the first nontrivial xy-segment
        if (fragment0 = PolygonWireOffsetContext.createOffsetSegment(points[i], points[i + 1], options.leftOffsetDistance))
          previousJoint = joint0 = new Joint(undefined, fragment0, points[i]);
      } else {
        const fragment1 = PolygonWireOffsetContext.createOffsetSegment(points[i], points[i + 1], options.leftOffsetDistance);
        if (fragment1) {  // append the next nontrivial xy-segment
          const newJoint = new Joint(fragment0, fragment1, points[i]);
          Joint.link(previousJoint, newJoint);
          previousJoint = newJoint;
          fragment0 = fragment1;
        }
      }
    }
    if (!fragment0 || !previousJoint || !joint0)
      return undefined; // no edge with positive xy-length
    const lastJoint = wrap ? joint0 : new Joint(fragment0, undefined, points[numPoints - 1]);
    Joint.link(previousJoint, lastJoint);
    Joint.annotateChain(joint0, options, numPoints);
    // make limited passes through the Joint chain until no self-intersections are removed
    for (let pass = 0; pass++ < 5;) {
      const state = Joint.removeDegeneratePrimitives(joint0, options, numPoints);
      joint0 = state.newStart;
      if (state.numJointRemoved === 0)
        break;
      /*
      if (Checker.noisy.PolygonOffset) {
        GeometryCoreTestIO.consoleLog("  POST REMOVE DEGENERATES  " + state.numJointRemoved);
        Joint.visitJointsOnChain(joint0, (joint: Joint) => { GeometryCoreTestIO.consoleLog(prettyPrint(joint.shallowExtract())); return true; });
      }
      */
    }
    const chain = LineString3d.create();
    Joint.collectStrokesFromChain(joint0, chain, numPoints);  // compute offset corners (by extension/trim)
    const n = chain.packedPoints.length;
    if (n > 1) {
      if (chain.packedPoints.front()!.isAlmostEqual(chain.packedPoints.back()!))
        return Loop.create(chain);
      else
        return Path.create(chain);
    }
    return undefined;
  }
}

/**
 * Context for building a wire xy-offset from a Path or Loop of CurvePrimitives
 * @internal
 */
export class CurveChainWireOffsetContext {
  /** construct a context. */
  public constructor() { }
  /**
   * Annotate a CurvePrimitive with properties `baseCurveStart` and `baseCurveEnd`.
   * @param cp curve primitive to annotate
   * @param startPoint optional start point
   * @param endPoint optional end point
   * @return the input CurvePrimitive with annotations
   */
  public static applyBasePoints(
    cp: CurvePrimitive | undefined, startPoint: Point3d | undefined, endPoint: Point3d | undefined,
  ): CurvePrimitive | undefined {
    if (cp !== undefined) {
      if (startPoint !== undefined)
        (cp as any).baseCurveStart = startPoint;
      if (endPoint !== undefined)
        (cp as any).baseCurveEnd = endPoint;
    }
    return cp;
  }
  /**
   * Create the offset of a single curve primitive as viewed in the xy-plane (ignoring z).
   * * Each primitive may be labeled (as an `any` object) with start or end point of base curve:
   *   * `(primitive as any).baseCurveStart: Point3d`
   *   * `(primitive as any).baseCurveEnd: Point3d`
   * @param curve primitive to offset
   * @param offsetDistanceOrOptions offset distance (positive to left of curve, negative to right) or options object
   */
  public static createSingleOffsetPrimitiveXY(
    curve: CurvePrimitive, offsetDistanceOrOptions: number | OffsetOptions,
  ): CurvePrimitive | CurvePrimitive[] | undefined {
    const offset = curve.constructOffsetXY(offsetDistanceOrOptions);
    if (offset === undefined)
      return undefined;
    // decorate each offset with its base curve's endpoints
    if (Array.isArray(offset)) {
      const basePrims = curve.collectCurvePrimitives(undefined, true, true);
      if (basePrims.length !== offset.length)
        return undefined; // unexpected aggregate curve type!
      for (let i = 0; i < basePrims.length; ++i)
        this.applyBasePoints(offset[i], basePrims[i].startPoint(), basePrims[i].endPoint());
      return offset;
    }
    return this.applyBasePoints(offset, curve.startPoint(), curve.endPoint());
  }
  /**
   * Construct curves that are offset from a Path or Loop as viewed in xy-plane (ignoring z).
   * * The construction will remove "some" local effects of features smaller than the offset distance, but will
   * not detect self intersection among widely separated edges.
   * * Visualization can be found at https://www.itwinjs.org/sandbox/SaeedTorabi/Offset
   * @param curves base curves.
   * @param offsetDistanceOrOptions offset distance (positive to left of curve, negative to right) or options object.
   */
  public static constructCurveXYOffset(
    curves: Path | Loop, offsetDistanceOrOptions: number | JointOptions | OffsetOptions,
  ): CurveCollection | undefined {
    const wrap: boolean = curves instanceof Loop;
    const offsetOptions = OffsetOptions.create(offsetDistanceOrOptions);
    const simpleOffsets: CurvePrimitive[] = [];
    /** traverse primitives (children of curves) and create simple offsets of each primitive as an array */
    for (const c of curves.children) {
      const c1 = CurveChainWireOffsetContext.createSingleOffsetPrimitiveXY(c, offsetOptions);
      if (c1 === undefined) {
        // bad .. maybe arc to inside?
      } else if (c1 instanceof CurvePrimitive) {
        simpleOffsets.push(c1);
      } else if (Array.isArray(c1)) {
        for (const c2 of c1) {
          if (c2 instanceof CurvePrimitive)
            simpleOffsets.push(c2);
        }
      }
    }
    /** create joints between array elements to make offsets as a linked list (joint0) */
    let fragment0;
    let newJoint;
    let previousJoint;
    let joint0;
    for (const fragment1 of simpleOffsets) {
      if (fragment1) {
        newJoint = new Joint(fragment0, fragment1, fragment1.fractionToPoint(0.0));
        if (newJoint !== undefined)
          if (joint0 === undefined)
            joint0 = newJoint;
        if (previousJoint)
          Joint.link(previousJoint, newJoint);
        previousJoint = newJoint;
        fragment0 = fragment1;
      }
    }
    if (joint0 && previousJoint && curves instanceof Loop)
      Joint.link(previousJoint, joint0);
    /** annotateChain sets some of the joints attributes (including how to extend curves or fill the gap between curves) */
    const numOffset = simpleOffsets.length;
    Joint.annotateChain(joint0, offsetOptions.jointOptions, numOffset);
    /** turn the Joint linked list into a CurveCollection. trimming is done in collectCurvesFromChain */
    const outputCurves: CurvePrimitive[] = [];
    Joint.collectCurvesFromChain(joint0, outputCurves, numOffset);
    return RegionOps.createLoopPathOrBagOfCurves(outputCurves, wrap, true);
  }
}
