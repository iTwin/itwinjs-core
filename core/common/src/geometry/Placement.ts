/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Geometry */

import { Angle, Constant, Matrix3d, Point2d, Point3d, Range2d, Range3d, Transform, Vector3d, YawPitchRollAngles, Range3dProps } from "@bentley/geometry-core";
import { Placement2dProps, Placement3dProps } from "../ElementProps";
import { Frustum } from "../Frustum";

/** A Range3d that is aligned with the axes of spatial coordinates.
 * @public
 */
export type AxisAlignedBox3d = Range3d;

/** The properties of a Range3d. */
export type AxisAlignedBox3dProps = Range3dProps;

/** A bounding box aligned to the orientation of a 3d Element
 * @public
 */
export type ElementAlignedBox3d = Range3d;

/** A bounding box aligned to the orientation of a 2d Element
 * @public
 */
export type ElementAlignedBox2d = Range2d;

/** A bounding box aligned to a local coordinate system
 * @public
 */
export type LocalAlignedBox3d = Range3d;

/** The placement of a GeometricElement3d. This includes the origin, orientation, and size (bounding box) of the element.
 * All geometry of a GeometricElement are relative to its placement.
 * @public
 */
export class Placement3d implements Placement3dProps {
  public constructor(public origin: Point3d, public angles: YawPitchRollAngles, public bbox: ElementAlignedBox3d) { }
  /** Get the rotation from local coordinates of this placement to world coordinates. */
  public get rotation(): Matrix3d { return this.angles.toMatrix3d(); }
  /** Get the transform from local coordinates of this placement to world coordinates. */
  public get transform(): Transform { return Transform.createOriginAndMatrix(this.origin, this.rotation); }

  /** Create a new Placement3d from a Placement3dProps. */
  public static fromJSON(json?: Placement3dProps): Placement3d {
    const props: any = json ? json : {};
    return new Placement3d(Point3d.fromJSON(props.origin), YawPitchRollAngles.fromJSON(props.angles), Range3d.fromJSON<ElementAlignedBox3d>(props.bbox));
  }

  /** Get the 8 corners, in world coordinates, of this placement. */
  public getWorldCorners(out?: Frustum): Frustum {
    const frust = Frustum.fromRange(this.bbox, out);
    frust.multiply(this.transform);
    return frust;
  }

  /** Set the contents of this Placement3d from another Placement3d */
  public setFrom(other: Placement3d) {
    this.origin.setFrom(other.origin);
    this.angles.setFrom(other.angles);
    this.bbox.setFrom(other.bbox);
  }

  /** Determine whether this Placement3d is valid. */
  public get isValid(): boolean { return !this.bbox.isNull && Math.max(this.origin.maxAbs(), this.bbox.maxAbs()) < Constant.circumferenceOfEarth; }

  /** Calculate the axis-aligned bounding box for this placement. */
  public calculateRange(): AxisAlignedBox3d {
    const range = new Range3d();
    if (!this.isValid)
      return range;

    this.transform.multiplyRange(this.bbox, range);

    // low and high are not allowed to be equal
    range.ensureMinLengths();
    return range;
  }
}

/** The placement of a GeometricElement2d. This includes the origin, rotation, and size (bounding box) of the element.
 * @public
 */
export class Placement2d implements Placement2dProps {
  public constructor(public origin: Point2d, public angle: Angle, public bbox: ElementAlignedBox2d) { }
  /** Get the rotation from local coordinates of this placement to world coordinates. */
  public get rotation(): Matrix3d { return Matrix3d.createRotationAroundVector(Vector3d.unitZ(), this.angle)!; }
  /** Get the transform from local coordinates of this placement to world coordinates. */
  public get transform(): Transform { return Transform.createOriginAndMatrix(Point3d.createFrom(this.origin), this.rotation); }
  /** Create a new Placement2d from a Placement2dProps. */
  public static fromJSON(json?: Placement2dProps): Placement2d {
    const props: any = json ? json : {};
    return new Placement2d(Point2d.fromJSON(props.origin), Angle.fromJSON(props.angle), Range2d.fromJSON(props.bbox));
  }

  /** Get the 8 corners, in world coordinates, of this placement. */
  public getWorldCorners(out?: Frustum): Frustum {
    const frust = Frustum.fromRange(this.bbox, out);
    frust.multiply(this.transform);
    return frust;
  }

  /** Determine whether this Placement2d is valid. */
  public get isValid(): boolean { return !this.bbox.isNull && Math.max(this.origin.maxAbs(), this.bbox.maxAbs()) < Constant.circumferenceOfEarth; }

  /** Set the contents of this Placement3d from another Placement3d */
  public setFrom(other: Placement2d) {
    this.origin.setFrom(other.origin);
    this.angle.setFrom(other.angle);
    this.bbox.setFrom(other.bbox);
  }

  /** Calculate the axis-aligned bounding box for this placement. */
  public calculateRange(): AxisAlignedBox3d {
    const range = new Range3d();
    if (!this.isValid)
      return range;

    this.transform.multiplyRange(Range3d.createRange2d(this.bbox, 0), range);

    // low and high are not allowed to be equal
    range.ensureMinLengths();
    range.low.z = - 1.0;  // is the 2dFrustumDepth, which === 1 meter
    range.high.z = 1.0;
    return range;
  }
}
