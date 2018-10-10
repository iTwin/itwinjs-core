/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module CartesianGeometry */

// import { Point2d } from "./Geometry2d";
/* tslint:disable:variable-name jsdoc-format no-empty */
import { Geometry, AxisOrder, AxisScaleSelect } from "../Geometry";
import { Point3d, Vector3d } from "./Point3dVector3d";
import { Transform } from "./Transform";
import { Matrix3d } from "./Matrix3d";
import { Range3d } from "./Range";
import { CurvePrimitive } from "../curve/CurvePrimitive";
import { CurveCollection } from "../curve/CurveCollection";
import { BSplineCurve3d } from "../bspline/BSplineCurve";
import { Arc3d } from "../curve/Arc3d";
import { LineSegment3d } from "../curve/LineSegment3d";
import { LineString3d } from "../curve/LineString3d";
import { Point3dArray } from "./PointHelpers";
/**
 * Helper class to accumulate points and vectors until there is enough data to define a coordinate system.
 *
 * * For the common case of building a right handed frame:
 *
 * ** create the FrameBuilder and make calls to announcePoint and announceVector.
 * ** the frame will be fully determined by an origin and two vectors.
 * ** the first call to announcePoint will set the origin.
 * **  additional calls to announcePoint will produce announceVector call with the vector from the origin.
 * ** After each announcement, call getValidatedFrame(false)
 * ** getValidatedFrame will succeed when it has two independent vectors.
 * *  to build a left handed frame,
 *
 * **  an origin and 3 independent vectors are required.
 * **  annouce as above, but query wtih getValidatedFrame (true).
 * **  this will use the third vector to select right or left handed frame.
 */
export class FrameBuilder {
  private _origin: undefined | Point3d;
  private _vector0: undefined | Vector3d;
  private _vector1: undefined | Vector3d;
  private _vector2: undefined | Vector3d;

  public clear() { this._origin = undefined; this._vector0 = undefined; this._vector1 = undefined; this._vector2 = undefined; }
  constructor() { this.clear(); }
  /** Try to assemble the data into a nonsingular transform.
   *
   * * If allowLeftHanded is false, vector0 and vector1 determine a right handed coordinate system.
   * * if allowLeftHanded is true, the z vector of the right handed system can be flipped to agree with vector2 direction.
   */
  public getValidatedFrame(allowLeftHanded: boolean = false): Transform | undefined {
    if (this._origin && this._vector0 && this._vector1) {
      if (!allowLeftHanded) {
        const matrix = Matrix3d.createRigidFromColumns(this._vector0, this._vector1, AxisOrder.XYZ);
        if (matrix)
          return Transform.createOriginAndMatrix(this._origin, matrix);
        // uh oh -- vector1 was not really independent.  clear everything after vector0.
        this._vector1 = this._vector2 = undefined;
      } else if (this._vector2) {
        const matrix = Matrix3d.createRigidFromColumns(this._vector0, this._vector1, AxisOrder.XYZ);
        if (matrix) {
          if (this._vector0.tripleProduct(this._vector1, this._vector2) < 0)
            matrix.scaleColumns(1.0, 1.0, -1.0);
          return Transform.createOriginAndMatrix(this._origin, matrix);
        }
        // uh oh again -- clear vector1 and vector2, reannounce vector2 as possible vector1??
        const vector2 = this._vector2;
        this._vector1 = this._vector2 = undefined;
        this.announceVector(vector2);
      }
    }
    return undefined;
  }
  // If vector0 is known but vector1 is not, make vector1 the cross of the upvector and vector0
  public applyDefaultUpVector(vector?: Vector3d) {
    if (vector && this._vector0 && !this._vector1 && !vector.isParallelTo(this._vector0)) {
      this._vector1 = vector.crossProduct(this._vector0);
    }
  }
  public get hasOrigin(): boolean { return this._origin !== undefined; }
  /** Return the number of vectors saved.   Because the save process checkes numerics, this should be the rank of the system.
   */
  public savedVectorCount(): number {
    if (!this._vector0)
      return 0;
    if (!this._vector1)
      return 1;
    if (!this._vector2)
      return 2;
    return 3;
  }
  /** announce a new point.  If this point is different from the origin, also announce the vector from the origin.*/
  public announcePoint(point: Point3d): number {
    if (!this._origin) {
      this._origin = point.clone();
      return this.savedVectorCount();
    }
    // the new point may provide an additional vector
    if (this._origin.isAlmostEqual(point))
      return this.savedVectorCount();
    return this.announceVector(this._origin.vectorTo(point));
  }
  public announceVector(vector: Vector3d): number {
    if (vector.isAlmostZero)
      return this.savedVectorCount();

    if (!this._vector0) { this._vector0 = vector; return 1; }

    if (!this._vector1) {
      if (!vector.isParallelTo(this._vector0)) { this._vector1 = vector; return 2; }
      return 1;
    }

    // vector0 and vector1 are independent.
    if (!this._vector2) {
      const unitPerpendicular = this._vector0.unitCrossProduct(this._vector1);
      if (unitPerpendicular && !Geometry.isSameCoordinate(0, unitPerpendicular.dotProduct(vector))) {
        this._vector2 = vector;
        return 3;
      }
      return 2;
    }
    // fall through if prior vectors are all there -- no need for the new one.
    return 3;
  }
  /** Inspect the content of the data.  Announce points and vectors.   Return when savedVectorCount becomes
   * sufficient for a coordinate system.
   */
  public announce(data: any) {
    if (this.savedVectorCount() > 1) return;
    if (data instanceof Point3d)
      this.announcePoint(data);
    else if (data instanceof Vector3d)
      this.announceVector(data);
    else if (Array.isArray(data)) {
      for (const child of data) {
        if (this.savedVectorCount() > 1)
          break;
        this.announce(child);
      }
    } else if (data instanceof CurvePrimitive) {
      if (data instanceof LineSegment3d) {
        this.announcePoint(data.startPoint());
        this.announcePoint(data.endPoint());
      } else if (data instanceof Arc3d) {
        const ray = data.fractionToPointAndDerivative(0.0);
        this.announcePoint(ray.origin);
        this.announceVector(ray.direction);
        this.announceVector(data.matrix.columnZCrossVector(ray.direction));
      } else if (data instanceof LineString3d) {
        for (const point of data.points) {
          this.announcePoint(point);
          if (this.savedVectorCount() > 1)
            break;
        }
      } else if (data instanceof BSplineCurve3d) {
        const point = Point3d.create();
        for (let i = 0; this.savedVectorCount() < 2; i++) {
          if (data.getPole(i, point) instanceof Point3d)
            this.announcePoint(point);
          else break;
        }
      }
      // TODO: unknown curve type.  Stroke? FrenetFrame?
    } else if (data instanceof CurveCollection) {
      if (data.children)
        for (const child of data.children) {
          this.announce(child);
          if (this.savedVectorCount() > 1)
            break;
        }
    }
  }
  /** create a localToWorld frame for the given data.
   *
   * *  origin is at first point
   * *  x axis in direction of first nonzero vector present or implied by the input.
   * *  y axis is perpendicular to x and contains (in positive side) the next vector present or implied by the input.
   */
  public static createRightHandedFrame(defaultUpVector: Vector3d | undefined, ...params: any[]): Transform | undefined {
    const builder = new FrameBuilder();
    for (const data of params) {
      builder.announce(data);
      builder.applyDefaultUpVector(defaultUpVector);
      const result = builder.getValidatedFrame(false);
      if (result !== undefined)
        return result;
    }
    // try direct evaluation of curve primitives?
    for (const data of params) {
      if (data instanceof CurveCollection) {
        const children = data.children;
        if (children) {
          for (const curve of children) {
            if (curve instanceof CurvePrimitive) {
              const frenetFrame = curve.fractionToFrenetFrame(0.0);
              if (frenetFrame)
                return frenetFrame;
            }
          }
        }
      }

    }
    return undefined;
  }
  /** create a map with
   * *  transform0 = the local to world
   * *  transform1 = world to local
   * * ideally all points in local xy plane
   */
  public static createRightHandedLocalToWorld(...params: any[]): Transform | undefined {
    const builder = new FrameBuilder();
    for (const data of params) {
      builder.announce(data);
      const localToWorld = builder.getValidatedFrame(false);
      if (localToWorld !== undefined)
        return localToWorld;
    }
    return undefined;
  }

  /**
   * try to create a frame whose xy plane is through points.
   *
   * *  if 3 or more distinct points are present, the x axis is from the first point to the most distance, and y direction is toward the
   * point most distant from that line.
   * @param points array of points
   */
  public static createFrameToDistantPoints(points: Point3d[]): Transform | undefined {
    if (points.length > 2) {
      const origin = points[0].clone();
      const vector01 = Vector3d.create();
      Point3dArray.vectorToMostDistantPoint(points, points[0], vector01);
      const vector02 = Vector3d.create();
      Point3dArray.vectorToPointWithMaxCrossProductMangitude(points, origin, vector01, vector02);
      const matrix = Matrix3d.createRigidFromColumns(vector01, vector02, AxisOrder.XYZ);
      if (matrix)
        return Transform.createRefs(origin, matrix);
    }
    return undefined;
  }
  /**
   * Create the localToWorld transform from a range to axes of its parent coordinate system.
   * @param range [in] range to inpsect
   * @param fractionX  [in] fractonal coordinate of frame origin x
   * @param fractionY [in] fractional coordinate of frame origin y
   * @param fractionZ [in] fractgional coordinate of frame origin z
   * @param scaleSelect [in] selects size of localToWorld axes.
   * @param defaultAxisLength [in] if true and any axis length is 0, that axis vector takes this physical length.
   */
  public static createLocalToWorldTransformInRange(
    range: Range3d,
    scaleSelect: AxisScaleSelect = AxisScaleSelect.NonUniformRangeContainment,
    fractionX: number = 0,
    fractionY: number = 0,
    fractionZ: number = 0,
    defaultAxisLength: number = 1.0): Transform {
    if (range.isNull)
      return Transform.createIdentity();
    let a = 1.0;
    let b = 1.0;
    let c = 1.0;
    if (scaleSelect === AxisScaleSelect.LongestRangeDirection) {
      a = b = c = Geometry.correctSmallMetricDistance(range.maxLength(), defaultAxisLength);
    } else if (scaleSelect === AxisScaleSelect.NonUniformRangeContainment) {
      a = Geometry.correctSmallMetricDistance(range.xLength(), defaultAxisLength) * Geometry.maxAbsDiff(fractionX, 0, 1);
      b = Geometry.correctSmallMetricDistance(range.yLength(), defaultAxisLength) * Geometry.maxAbsDiff(fractionY, 0, 1);
      c = Geometry.correctSmallMetricDistance(range.zLength(), defaultAxisLength) * Geometry.maxAbsDiff(fractionZ, 0, 1);
    }
    return Transform.createRefs(range.fractionToPoint(fractionX, fractionY, fractionZ), Matrix3d.createScale(a, b, c));
  }

}
