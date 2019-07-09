/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/* tslint:disable: no-console */
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { BagOfCurves, CurveCollection } from "./CurveCollection";
import { CurvePrimitive } from "./CurvePrimitive";
import { LineSegment3d } from "./LineSegment3d";
import { Ray3d } from "../geometry3d/Ray3d";
import { CurveCurveApproachType } from "./CurveLocationDetail";

/**
 * Classification of contortions at a joint.
 * @internal
 */
enum JointMode {
  Unknown = 0,
  Cap = 1,
  Extend = 2,
  Trim = -1,
  JustGeometry = 3,
  Gap = 4,
}
/**
 * Description of geometry around a joint.
 * @internal
 */
class Joint {
  /** Enumeration of how the joint is constructed */
  public flexure: JointMode;

  /** curve before the joint */
  public curve0?: CurvePrimitive;
  /** fractional position on curve0 (may be a trim or extension) */
  public fraction0?: number;
  /** curve after the joint (may be a trim or extension) */
  public curve1?: CurvePrimitive;
  /** fractional position on curve1 */
  public fraction1?: number;
  /** curve to be added within the joint */
  public jointCurve?: CurvePrimitive;
  /** common point on the original curves */
  public swingPoint?: Point3d;
  /** pointer to next joint */
  public nextJoint?: Joint;
  /** pointer to previous joint */
  public previousJoint?: Joint;
  // capture references to all data . . .
  public constructor(curve0: CurvePrimitive | undefined, curve1: CurvePrimitive | undefined, swingPoint: Point3d | undefined) {
    this.curve0 = curve0;
    this.curve1 = curve1;
    this.swingPoint = swingPoint;
    this.flexure = JointMode.Unknown;
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
  /**
   * Get the very first or very last point of a curve collection. (Recursive search if needed)
   * @param collection
   * @param atEnd
   */
  public static getCollectionStartOrEnd(collection: CurveCollection, atEnd: boolean): Point3d | undefined {
    const children = collection.children;
    if (children && children.length > 0) {
      const child = atEnd ? children[children.length - 1] : children[0];
      if (child instanceof CurvePrimitive)
        return atEnd ? child.endPoint() : child.startPoint();
      else if (child instanceof CurveCollection)
        return this.getCollectionStartOrEnd(child, atEnd);
    }
    return undefined;
  }
  /**
   *
   * @param start first Joint of chain
   * @param destination CurveCollection to receive geometry
   */
  public static collectPrimitivesFromChain(start: Joint, destination: CurveCollection, maxTest: number = 100) {
    let numOut = -2 * maxTest;    // allow extra things to happen
    Joint.visitJointsOnChain(start, (joint: Joint) => {
      if (joint.jointCurve)
        destination.tryAddChild(joint.jointCurve.clone() as CurvePrimitive);
      if (joint.curve1 && joint.fraction1 !== undefined) {
        const fA = joint.fraction1;
        const fB = joint.nextJointFraction0(1.0);
        let curve1;
        if (fA === 0.0 && fB === 1.0)
          curve1 = joint.curve1.clone() as CurvePrimitive;
        else if (fA < fB)
          curve1 = joint.curve1.clonePartialCurve(fA, fB);
        if (curve1) {
          if (!joint.jointCurve) {
            const gapStartPoint = this.getCollectionStartOrEnd(destination, true);
            const gapEndPoint = curve1.startPoint();
            if (gapStartPoint && !gapStartPoint.isAlmostEqual(gapEndPoint))
              destination.tryAddChild(LineSegment3d.create(gapStartPoint, gapEndPoint));
          }
        }

        destination.tryAddChild(curve1);
      }
      return numOut++ < maxTest;
    });
  }
  /** Execute `joint.annotateJointMode()` at all joints on the chain. */
  public static annotateChain(start: Joint, maxTest: number = 100) {
    Joint.visitJointsOnChain(start, (joint: Joint) => { joint.annotateJointMode(); return true; }, maxTest);
  }

  /**
   * Visit joints on a chain.
   * * terminate on `false` return from `callback`
   * @param start first (and, for cyclic chain, final) Joint
   * @param callback function to call with each Joint as a single parameter.
   */
  public static visitJointsOnChain(start: Joint, callback: (joint: Joint) => boolean, maxTest: number = 100): boolean {
    let joint: Joint | undefined = start;
    if (joint) {
      let numTest = 0;
      while (joint !== undefined) {
        if (numTest++ >= maxTest + 5)
          return true;
        if (!callback(joint)) return false;
        joint = joint.nextJoint;
        if (joint === start)
          break;
      }
    }
    return true;
  }
  /**
   * Examine the adjacent geometry
   * * set JointMode:  one of Cap Extend, or Trim
   * * set fraction0 and fraction1 of intersection of curve0 and curve1
   * * this REFERENCES curve0, curve1, fraction0, fraction1
   * * this does not reference nextJoint and previousJoint
   */
  public annotateJointMode() {
    if (this.curve0 && !this.curve1) {
      this.flexure = JointMode.Cap;
      this.fraction0 = 1.0;
    } else if (this.curve1 && !this.curve0) {
      this.flexure = JointMode.Cap;
      this.fraction1 = 0.0;
    } else if (this.curve0 && this.curve1) {
      if (this.curve0 instanceof LineSegment3d && this.curve1 instanceof LineSegment3d) {
        const ray0 = this.curve0.fractionToPointAndDerivative(0.0); // And we know that is full length ray !
        const ray1 = this.curve1.fractionToPointAndDerivative(0.0); // ditto
        const intersection = Ray3d.closestApproachRay3dRay3d(ray0, ray1);
        if (intersection.approachType === CurveCurveApproachType.Intersection) {
          this.fraction0 = intersection.detailA.fraction;
          this.fraction1 = intersection.detailB.fraction;
          if (this.fraction0 >= 1.0 && this.fraction1 <= 0.0) {
            this.flexure = JointMode.Extend;
            const theta = ray0.getDirectionRef().angleToXY(ray1.getDirectionRef());
            if (Math.abs(theta.degrees) > 90) {
              const radians0 = theta.radians;
              const radians1 = radians0 * 0.25;
              const q = Math.cos(radians0 * 0.5) / Math.cos(radians1);
              const df0 = (this.fraction0 - 1) * q;
              const df1 = (this.fraction1) * q;
              this.fraction0 = 1 + df0;
              this.fraction1 = df1;
              this.jointCurve = LineSegment3d.create(this.curve0.fractionToPoint(this.fraction0), this.curve1.fractionToPoint(this.fraction1));
            }
          } else if (this.fraction0 < 1.0 && this.fraction1 > 0.0) {
            this.flexure = JointMode.Trim;
          } else if (this.fraction0 > 1.0 && this.fraction1 > 1.0) {
            this.flexure = JointMode.Gap;
            this.jointCurve = LineSegment3d.create(this.curve0.fractionToPoint(1.0), this.curve1.fractionToPoint(0.0));
            this.fraction0 = 1.0;
            this.fraction1 = 0.0;
          }
        }
      }
    }
  }
  /**
   * * Examine the primitive trim fractions between each pair of joints.
   * * If trim fractions indicate the primitive must disappear, replace the joint pair by a new joint pointing at surrounding primitives
   * @param start
   */
  public static removeDegeneratePrimitives(start: Joint, maxTest: number): { newStart: Joint; numJointRemoved: number } {
    /*
    if (Checker.noisy.PolygonOffset)
      console.log("\nENTER removeDegenerates");
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
          && jointB.fraction0 !== undefined) {
          const f0 = jointA.fraction1;
          const f1 = jointB.fraction0;
          const g0 = jointB.fraction1;
          const g1 = jointB.nextJoint.fraction0;
          // f0 and f1 are fractions on the single primitive between these joints.
          /*
            if (Checker.noisy.PolygonOffset) {
              console.log("joint candidate");
              console.log(prettyPrint(jointA.shallowExtract()));
              console.log(prettyPrint(jointB.shallowExtract()));
              console.log("FRACTIONS ", { fA1: f0, fB0: f1 });
            }
          */
          const eliminateF = f0 >= f1 || f0 > 1.0;
          const eliminateG = (g0 !== undefined && g0 > 1.0)
            || (g0 !== undefined && g1 !== undefined && g0 >= g1);
          if (eliminateF && eliminateG) {
            const jointC = jointB.nextJoint;
            const newJoint: Joint = new Joint(jointA.curve0, jointC.curve1, undefined);
            Joint.link(jointA.previousJoint, newJoint);
            Joint.link(newJoint, jointC.nextJoint);
            newJoint.annotateJointMode();
            newJoint.previousJoint!.annotateJointMode();
            if (newJoint.nextJoint)
              newJoint.nextJoint.annotateJointMode();
            /*
            if (Checker.noisy.PolygonOffset) {
              console.log(" NEW DOUBLE CUT");
              console.log(prettyPrint(newJoint.shallowExtract()));
            }
            */
          } else if (eliminateF) {
            const newJoint: Joint = new Joint(jointA.curve0, jointB.curve1, undefined);
            Joint.link(jointA.previousJoint, newJoint);
            Joint.link(newJoint, jointB.nextJoint);
            newJoint.annotateJointMode();
            newJoint.previousJoint!.annotateJointMode();
            newJoint.nextJoint!.annotateJointMode();
            /*
            if (Checker.noisy.PolygonOffset) {
              console.log(" NEW JOINT");
              console.log(prettyPrint(newJoint.shallowExtract()));
            }
          */
            numRemoved++;
            if (jointA === start)
              start = newJoint;
            jointA = newJoint;
            if (numRemoved >= maxRemove) {
              /*
              if (Checker.noisy.PolygonOffset)
                console.log(" EXIT removeDegenerates at maxRemove\n");
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
 * Context for building a wire offset.
 * @internal
 */
export class PolygonWireOffsetContext {
  /** construct a context. */
  public constructor() {
  }
  private static _unitAlong = Vector3d.create();
  private static _unitPerp = Vector3d.create();
  private static _offsetA = Point3d.create();
  private static _offsetB = Point3d.create();

  // Construct a single offset from base points
  private static createOffsetSegment(basePointA: Point3d, basePointB: Point3d, distance: number): CurvePrimitive | undefined {
    Vector3d.createStartEnd(basePointA, basePointB, this._unitAlong);
    if (this._unitAlong.normalizeInPlace()) {
      this._unitAlong.rotate90CCWXY(this._unitPerp);
      return LineSegment3d.create(
        basePointA.plusScaled(this._unitPerp, distance, this._offsetA),
        basePointB.plusScaled(this._unitPerp, distance, this._offsetB));
    }
    return undefined;
  }
  /**
   * Construct curves that are offset from a polygon.
   * * The construction will remove "some" local effects of features smaller than the offset distance, but will not detect self intersection with far-away edges.
   * @param points
   * @param wrap
   * @param offsetDistance
   */
  public constructPolygonWireXYOffset(points: Point3d[], wrap: boolean, offsetDistance: number): CurveCollection | undefined {
    const numPoints = points.length;
    let fragment0 = PolygonWireOffsetContext.createOffsetSegment(points[0], points[1], offsetDistance);
    let joint0 = new Joint(undefined, fragment0, points[0]);
    let newJoint;
    let previousJoint = joint0;
    for (let i = 1; i + 1 < numPoints; i++) {
      const fragment1 = PolygonWireOffsetContext.createOffsetSegment(points[i], points[i + 1], offsetDistance);
      newJoint = new Joint(fragment0, fragment1, points[i]);
      Joint.link(previousJoint, newJoint);
      previousJoint = newJoint;
      fragment0 = fragment1;
    }
    if (wrap)
      Joint.link(previousJoint, joint0);
    const result = new BagOfCurves();
    Joint.annotateChain(joint0, numPoints);
    for (let pass = 0; pass++ < 5;) {
      const state = Joint.removeDegeneratePrimitives(joint0, numPoints);
      joint0 = state.newStart;
      if (state.numJointRemoved === 0)
        break;
      /*
      if (Checker.noisy.PolygonOffset) {
        console.log("  POST REMOVE DEGENERATES  " + state.numJointRemoved);
        Joint.visitJointsOnChain(joint0, (joint: Joint) => { console.log(prettyPrint(joint.shallowExtract())); return true; });
      }
      */

      // Joint.collectPrimitivesFromChain(joint0, result);
    }

    Joint.collectPrimitivesFromChain(joint0, result, numPoints);
    return result;
    // return undefined;
  }
}
