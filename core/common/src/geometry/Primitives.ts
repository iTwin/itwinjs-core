/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import {
  Point2d, Point3d, Vector3d, YawPitchRollAngles, XYAndZ, XAndY, LowAndHighXY,
  Range2d, Range3d, Angle, Transform, RotMatrix, Constant,
} from "@bentley/geometry-core";
import { Placement2dProps, Placement3dProps } from "../ElementProps";

/**
 * A Range3d that is aligned with the axes of a coordinate space.
 */
export class AxisAlignedBox3d extends Range3d {
  constructor(low?: XYAndZ, high?: XYAndZ) {
    if (low === undefined || high === undefined)
      super(); // defines an empty box
    else
      super(low.x, low.y, low.z, high.x, high.y, high.z);
  }
  public static fromRange2d(r: LowAndHighXY) { const v = new AxisAlignedBox3d(); v.low.x = r.low.x; v.low.y = r.low.y; v.high.x = r.high.x; v.high.y = r.high.y; return v; }

  public getCenter(): Point3d { return this.low.interpolate(.5, this.high); }

  public fixRange() {
    if (this.low.x === this.high.x) {
      this.low.x -= .0005;
      this.high.x += .0005;
    }
    if (this.low.y === this.high.y) {
      this.low.y -= .0005;
      this.high.y += .0005;
    }
    if (this.low.z === this.high.z) {
      this.low.z -= .0005;
      this.high.z += .0005;
    }
  }
  public static fromJSON(json: any): AxisAlignedBox3d {
    const val = new AxisAlignedBox3d();
    val.setFromJSON(json);
    return val;
  }
}

/** A bounding box aligned to the orientation of a 3d Element */
export class ElementAlignedBox3d extends Range3d {
  public static createFromPoints(low: XYAndZ, high: XYAndZ): ElementAlignedBox3d { return new ElementAlignedBox3d(low.x, low.y, low.z, high.x, high.y, high.z); }
  public get left(): number { return this.low.x; }
  public get bottom(): number { return this.low.y; }
  public get front(): number { return this.low.z; }
  public get right(): number { return this.high.x; }
  public get top(): number { return this.high.y; }
  public get back(): number { return this.high.z; }
  public get width(): number { return this.xLength(); }
  public get depth(): number { return this.yLength(); }
  public get height(): number { return this.zLength(); }
  public isValid(): boolean {
    const max = Constant.circumferenceOfEarth; const lo = this.low; const hi = this.high;
    return !this.isNull() && lo.x > -max && lo.y > -max && lo.z > -max && hi.x < max && hi.y < max && hi.z < max;
  }

  public static fromJSON(json?: any): ElementAlignedBox3d {
    const val = new ElementAlignedBox3d();
    if (json)
      val.setFromJSON(json);
    return val;
  }
}

/** A bounding box aligned to the orientation of a 2d Element */
export class ElementAlignedBox2d extends Range2d {
  public static createFromPoints(low: XAndY, high: XAndY): ElementAlignedBox2d { return new ElementAlignedBox2d(low.x, low.y, high.x, high.y); }
  public get left(): number { return this.low.x; }
  public get bottom(): number { return this.low.y; }
  public get right(): number { return this.high.x; }
  public get top(): number { return this.high.y; }
  public get width(): number { return this.xLength(); }
  public get height(): number { return this.yLength(); }
  public static fromJSON(json?: any): ElementAlignedBox2d {
    const val = new ElementAlignedBox2d();
    if (json)
      val.setFromJSON(json);
    return val;
  }
  public isValid(): boolean {
    const max = Constant.circumferenceOfEarth; const lo = this.low; const hi = this.high;
    return !this.isNull() && lo.x > -max && lo.y > -max && hi.x < max && hi.y < max;
  }
}

/**
 * The placement of a GeometricElement3d. This includes the origin, orientation, and size (bounding box) of the element.
 * All geometry of a GeometricElement are relative to its placement.
 */
export class Placement3d implements Placement3dProps {
  public constructor(public origin: Point3d, public angles: YawPitchRollAngles, public bbox: ElementAlignedBox3d) { }
  public getTransform(): Transform { return Transform.createOriginAndMatrix(this.origin, this.angles.toRotMatrix()); }
  public static fromJSON(json?: any): Placement3d {
    json = json ? json : {};
    return new Placement3d(Point3d.fromJSON(json.origin), YawPitchRollAngles.fromJSON(json.angles), ElementAlignedBox3d.fromJSON(json.bbox));
  }

  public setFrom(other: Placement3d) {
    this.origin.setFrom(other.origin);
    this.angles.setFrom(other.angles);
    this.bbox.setFrom(other.bbox);
  }

  /** Determine whether this Placement3d is valid. */
  public isValid(): boolean { return this.bbox.isValid() && this.origin.maxAbs() < Constant.circumferenceOfEarth; }

  public calculateRange(): AxisAlignedBox3d {
    const range = new AxisAlignedBox3d();

    if (!this.isValid())
      return range;

    this.getTransform().multiplyRange(this.bbox, range);

    // low and high are not allowed to be equal
    range.fixRange();
    return range;
  }
}

/** The placement of a GeometricElement2d. This includes the origin, rotation, and size (bounding box) of the element. */
export class Placement2d implements Placement2dProps {
  public constructor(public origin: Point2d, public angle: Angle, public bbox: ElementAlignedBox2d) { }
  public getTransform(): Transform { return Transform.createOriginAndMatrix(Point3d.createFrom(this.origin), RotMatrix.createRotationAroundVector(Vector3d.unitZ(), this.angle)!); }
  public static fromJSON(json?: any): Placement2d {
    json = json ? json : {};
    return new Placement2d(Point2d.fromJSON(json.origin), Angle.fromJSON(json.angle), ElementAlignedBox2d.fromJSON(json.bbox));
  }

  /** Determine whether this Placement2d is valid. */
  public isValid(): boolean { return this.bbox.isValid() && this.origin.maxAbs() < Constant.circumferenceOfEarth; }

  public setFrom(other: Placement2d) {
    this.origin.setFrom(other.origin);
    this.angle.setFrom(other.angle);
    this.bbox.setFrom(other.bbox);
  }

  public calculateRange(): AxisAlignedBox3d {
    const range = new AxisAlignedBox3d();

    if (!this.isValid())
      return range;

    this.getTransform().multiplyRange(Range3d.createRange2d(this.bbox, 0), range);

    // low and high are not allowed to be equal
    range.fixRange();

    range.low.z = - 1.0;  // is the 2dFrustumDepth, which === 1 meter
    range.high.z = 1.0;

    return range;
  }
}
