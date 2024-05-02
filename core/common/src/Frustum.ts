/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import {
  AxisOrder, ClipPlane, ConvexClipPlaneSet, Geometry, GrowableXYZArray, LowAndHighXY, LowAndHighXYZ, Map4d, Matrix3d, Plane3dByOriginAndUnitNormal, Point3d, Range3d, Transform, Vector3d, XYAndZ,
} from "@itwin/core-geometry";

/** The 8 corners of the [Normalized Plane Coordinate]($docs/learning/glossary.md#npc) cube.
 * @public
 * @extensions
 */
export enum Npc {
  /** Left bottom rear */
  _000 = 0,
  /** Right bottom rear */
  _100 = 1,
  /** Left top rear */
  _010 = 2,
  /** Right top rear */
  _110 = 3,
  /** Left bottom front */
  _001 = 4,
  /** Right bottom front */
  _101 = 5,
  /** Left top front */
  _011 = 6,
  /** Right top front */
  _111 = 7,

  /* eslint-disable @typescript-eslint/no-duplicate-enum-values */
  LeftBottomRear = 0,
  RightBottomRear = 1,
  LeftTopRear = 2,
  RightTopRear = 3,
  LeftBottomFront = 4,
  RightBottomFront = 5,
  LeftTopFront = 6,
  RightTopFront = 7,
  /* eslint-enable @typescript-eslint/no-duplicate-enum-values */
  /** useful for sizing arrays */
  CORNER_COUNT = 8,
}

/** The 8 corners of an [[Npc]] Frustum.
 * @public
 */
export const NpcCorners = [ // eslint-disable-line @typescript-eslint/naming-convention
  new Point3d(0.0, 0.0, 0.0),
  new Point3d(1.0, 0.0, 0.0),
  new Point3d(0.0, 1.0, 0.0),
  new Point3d(1.0, 1.0, 0.0),
  new Point3d(0.0, 0.0, 1.0),
  new Point3d(1.0, 0.0, 1.0),
  new Point3d(0.0, 1.0, 1.0),
  new Point3d(1.0, 1.0, 1.0),
];
NpcCorners.forEach((corner) => Object.freeze(corner));
Object.freeze(NpcCorners);

/** The center point of the [Normalized Plane Coordinate]($docs/learning/glossary.md#npc) cube.
 * @public
 */
export const NpcCenter = new Point3d(.5, .5, .5); // eslint-disable-line @typescript-eslint/naming-convention
Object.freeze(NpcCenter);

/** The region of physical (3d) space that appears in a view. It forms the field-of-view of a camera.
 * It is stored as 8 points, in [[Npc]] order, that must define a truncated pyramid.
 * @public
 */
export class Frustum {
  /** Array of the 8 points of this Frustum. */
  public readonly points: Point3d[] = [];
  /** Constructor for Frustum. Members are initialized to the Npc cube. */
  public constructor() {
    for (let i = 0; i < 8; ++i)
      this.points[i] = NpcCorners[i].clone();
  }

  /** Initialize this Frustum to the 8 corners of the NPC cube. */
  public initNpc() {
    for (let i = 0; i < 8; ++i)
      Point3d.createFrom(NpcCorners[i], this.points[i]);

    return this;
  }

  /** Get a corner Point from this Frustum. */
  public getCorner(i: number) { return this.points[i]; }
  /** Get the point at the center of this Frustum (halfway between RightTopFront and LeftBottomRear. */
  public getCenter(): Point3d {
    return this.getCorner(Npc.RightTopFront).interpolate(0.5, this.getCorner(Npc.LeftBottomRear));
  }

  /** Get the distance between two corners of this Frustum. */
  public distance(corner1: number, corner2: number): number {
    return this.getCorner(corner1).distance(this.getCorner(corner2));
  }

  /** Get the ratio of the length of the diagonal of the front plane to the diagonal of the back plane. */
  public getFraction(): number {
    return Geometry.safeDivideFraction(this.distance(Npc.LeftTopFront, Npc.RightBottomFront), this.distance(Npc.LeftTopRear, Npc.RightBottomRear), 0);
  }

  /** Multiply all the points of this Frustum by a Transform, in place. */
  public multiply(trans: Transform): void {
    trans.multiplyPoint3dArrayInPlace(this.points);
  }

  /** Offset all of the points of this Frustum by a vector. */
  public translate(offset: XYAndZ): void {
    for (const pt of this.points)
      pt.plus(offset, pt);
  }

  /** Transform all the points of this Frustum and return the result in another Frustum. */
  public transformBy(trans: Transform, result?: Frustum): Frustum {
    result = result ? result : new Frustum();
    trans.multiplyPoint3dArray(this.points, result.points);
    return result;
  }

  /** Calculate a bounding range from the 8 points in this Frustum. */
  public toRange(range?: Range3d): Range3d {
    return Range3d.createArray(this.points, range);
  }

  /** Make a copy of this Frustum.
   * @param result Optional Frustum for copy. If undefined allocate a new Frustum.
   */
  public clone(result?: Frustum): Frustum {
    result = result ? result : new Frustum();
    result.setFrom(this);
    return result;
  }

  /** Set the points of this Frustum to be copies of the points in another Frustum. */
  public setFrom(other: Frustum) { this.setFromCorners(other.points); }
  /** Set the points of this frustum from array of corner points in NPC order. */
  public setFromCorners(corners: Point3d[]) {
    for (let i = 0; i < 8; ++i)
      this.points[i].setFrom(corners[i]);
  }

  /** Scale this Frustum, in place, about its center by a scale factor. */
  public scaleAboutCenter(scale: number): void {
    const orig = this.clone();
    const f = 0.5 * (1.0 + scale);
    orig.points[Npc._111].interpolate(f, orig.points[Npc._000], this.points[Npc._000]);
    orig.points[Npc._011].interpolate(f, orig.points[Npc._100], this.points[Npc._100]);
    orig.points[Npc._101].interpolate(f, orig.points[Npc._010], this.points[Npc._010]);
    orig.points[Npc._001].interpolate(f, orig.points[Npc._110], this.points[Npc._110]);
    orig.points[Npc._110].interpolate(f, orig.points[Npc._001], this.points[Npc._001]);
    orig.points[Npc._010].interpolate(f, orig.points[Npc._101], this.points[Npc._101]);
    orig.points[Npc._100].interpolate(f, orig.points[Npc._011], this.points[Npc._011]);
    orig.points[Npc._000].interpolate(f, orig.points[Npc._111], this.points[Npc._111]);
  }
  /** The point at the center of the front face of this frustum */
  public get frontCenter() {
    return this.getCorner(Npc.LeftBottomFront).interpolate(.5, this.getCorner(Npc.RightTopFront));
  }

  /** The point at the center of the rear face of this frustum */
  public get rearCenter() {
    return this.getCorner(Npc.LeftBottomRear).interpolate(.5, this.getCorner(Npc.RightTopRear));
  }

  /** Scale this frustum's XY (viewing) plane about its center */
  public scaleXYAboutCenter(scale: number) {
    const frontCenter = this.frontCenter, rearCenter = this.rearCenter;
    frontCenter.interpolate(scale, this.points[Npc.LeftTopFront], this.points[Npc.LeftTopFront]);
    frontCenter.interpolate(scale, this.points[Npc.RightTopFront], this.points[Npc.RightTopFront]);
    frontCenter.interpolate(scale, this.points[Npc.LeftBottomFront], this.points[Npc.LeftBottomFront]);
    frontCenter.interpolate(scale, this.points[Npc.RightBottomFront], this.points[Npc.RightBottomFront]);

    rearCenter.interpolate(scale, this.points[Npc.LeftTopRear], this.points[Npc.LeftTopRear]);
    rearCenter.interpolate(scale, this.points[Npc.RightTopRear], this.points[Npc.RightTopRear]);
    rearCenter.interpolate(scale, this.points[Npc.LeftBottomRear], this.points[Npc.LeftBottomRear]);
    rearCenter.interpolate(scale, this.points[Npc.RightBottomRear], this.points[Npc.RightBottomRear]);
  }

  /** Create a Map4d that converts world coordinates to/from [[Npc]] coordinates of this Frustum. */
  public toMap4d(): Map4d | undefined {
    const org = this.getCorner(Npc.LeftBottomRear);
    const xVec = org.vectorTo(this.getCorner(Npc.RightBottomRear));
    const yVec = org.vectorTo(this.getCorner(Npc.LeftTopRear));
    const zVec = org.vectorTo(this.getCorner(Npc.LeftBottomFront));
    return Map4d.createVectorFrustum(org, xVec, yVec, zVec, this.getFraction());
  }

  /** Get the rotation matrix to the frame of this frustum.  This is equivalent to the view rotation matrix. */
  public getRotation(result?: Matrix3d): Matrix3d | undefined {
    const org = this.getCorner(Npc.LeftBottomRear);
    const xVec = org.vectorTo(this.getCorner(Npc.RightBottomRear));
    const yVec = org.vectorTo(this.getCorner(Npc.LeftTopRear));
    const matrix = Matrix3d.createRigidFromColumns(xVec, yVec, AxisOrder.XYZ, result);
    if (matrix)
      matrix.transposeInPlace();
    return matrix;
  }

  /** Get the eye point  - undefined if parallel projection */
  public getEyePoint(result?: Point3d): Point3d | undefined {
    const fraction = this.getFraction();

    if (Math.abs(fraction - 1) < 1E-8)
      return undefined;     // Parallel.

    const org = this.getCorner(Npc.LeftBottomRear);
    const zVec = org.vectorTo(this.getCorner(Npc.LeftBottomFront));

    return org.plusScaled(zVec, 1 / (1 - fraction), result);
  }

  /** Invalidate this Frustum by setting all 8 points to zero. */
  public invalidate(): void {
    for (let i = 0; i < 8; ++i)
      this.points[i].set(0, 0, 0);
  }

  /** Return true if this Frustum is equal to another Frustum */
  public equals(rhs: Frustum): boolean {
    for (let i = 0; i < 8; ++i) {
      if (!this.points[i].isExactEqual(rhs.points[i]))
        return false;
    }
    return true;
  }
  /** Return true if all of the points in this Frustum are *almost* the same as the points in another Frustum.
   * @see [[equals]], [XYZ.isAlmostEqual]($geometry)
   */
  public isSame(other: Frustum): boolean {
    for (let i = 0; i < 8; ++i) {
      if (!this.points[i].isAlmostEqual(other.points[i]))
        return false;
    }

    return true;
  }

  /** Initialize this Frustum from a Range */
  public initFromRange(range: LowAndHighXYZ | LowAndHighXY): void {
    const getZ = (arg: any): number => arg.z !== undefined ? arg.z : 0;
    const pts = this.points;
    pts[0].x = pts[2].x = pts[4].x = pts[6].x = range.low.x;
    pts[1].x = pts[3].x = pts[5].x = pts[7].x = range.high.x;
    pts[0].y = pts[1].y = pts[4].y = pts[5].y = range.low.y;
    pts[2].y = pts[3].y = pts[6].y = pts[7].y = range.high.y;
    pts[0].z = pts[1].z = pts[2].z = pts[3].z = getZ(range.low);
    pts[4].z = pts[5].z = pts[6].z = pts[7].z = getZ(range.high);
  }

  /** Create a new Frustum from a Range3d */
  public static fromRange(range: LowAndHighXYZ | LowAndHighXY, out?: Frustum): Frustum {
    const frustum = undefined !== out ? out : new Frustum();
    frustum.initFromRange(range);
    return frustum;
  }

  /** Return true if this Frustum has a mirror (is not in the correct order.) */
  public get hasMirror(): boolean {
    const pts = this.points;
    const u = pts[Npc._000].vectorTo(pts[Npc._001]);
    const v = pts[Npc._000].vectorTo(pts[Npc._010]);
    const w = pts[Npc._000].vectorTo(pts[Npc._100]);
    return (u.tripleProduct(v, w) > 0);
  }
  /** Make sure the frustum point order does not include mirroring. If so, reverse the order. */
  public fixPointOrder(): void {
    if (!this.hasMirror)
      return;

    // frustum has mirroring, reverse points
    const pts = this.points;
    for (let i = 0; i < 8; i += 2) {
      const tmpPoint = pts[i];
      pts[i] = pts[i + 1];
      pts[i + 1] = tmpPoint;
    }
  }

  /** Get a convex set of clipping planes bounding the region contained by this Frustum. */
  public getRangePlanes(clipFront: boolean, clipBack: boolean, expandPlaneDistance: number): ConvexClipPlaneSet {
    const convexSet = ConvexClipPlaneSet.createEmpty();
    const scratchNormal = Vector3d.create();
    Vector3d.createCrossProductToPoints(this.points[5], this.points[3], this.points[1], scratchNormal);
    if (scratchNormal.normalizeInPlace())
      convexSet.addPlaneToConvexSet(ClipPlane.createNormalAndDistance(scratchNormal, scratchNormal.dotProduct(this.points[1]) - expandPlaneDistance));
    Vector3d.createCrossProductToPoints(this.points[2], this.points[4], this.points[0], scratchNormal);
    if (scratchNormal.normalizeInPlace())
      convexSet.addPlaneToConvexSet(ClipPlane.createNormalAndDistance(scratchNormal, scratchNormal.dotProduct(this.points[0]) - expandPlaneDistance));
    Vector3d.createCrossProductToPoints(this.points[3], this.points[6], this.points[2], scratchNormal);
    if (scratchNormal.normalizeInPlace())
      convexSet.addPlaneToConvexSet(ClipPlane.createNormalAndDistance(scratchNormal, scratchNormal.dotProduct(this.points[2]) - expandPlaneDistance));
    Vector3d.createCrossProductToPoints(this.points[4], this.points[1], this.points[0], scratchNormal);
    if (scratchNormal.normalizeInPlace())
      convexSet.addPlaneToConvexSet(ClipPlane.createNormalAndDistance(scratchNormal, scratchNormal.dotProduct(this.points[0]) - expandPlaneDistance));

    if (clipBack) {
      Vector3d.createCrossProductToPoints(this.points[1], this.points[2], this.points[0], scratchNormal);
      if (scratchNormal.normalizeInPlace())
        convexSet.addPlaneToConvexSet(ClipPlane.createNormalAndDistance(scratchNormal, scratchNormal.dotProduct(this.points[0]) - expandPlaneDistance));
    }
    if (clipFront) {
      Vector3d.createCrossProductToPoints(this.points[6], this.points[5], this.points[4], scratchNormal);
      if (scratchNormal.normalizeInPlace())
        convexSet.addPlaneToConvexSet(ClipPlane.createNormalAndDistance(scratchNormal, scratchNormal.dotProduct(this.points[4]) - expandPlaneDistance));
    }
    return convexSet;
  }

  /** Get a (convex) polygon that represents the intersection of this frustum with a plane, or undefined if no intersection exists */
  public getIntersectionWithPlane(plane: Plane3dByOriginAndUnitNormal): Point3d[] | undefined {
    const clipPlane = ClipPlane.createPlane(plane);
    const loopPoints = clipPlane.intersectRange(this.toRange(), true);
    if (undefined === loopPoints)
      return undefined;

    const convexSet = this.getRangePlanes(false, false, 0);
    const workPoints = new GrowableXYZArray();
    const outPoints = new GrowableXYZArray();
    convexSet.polygonClip(loopPoints, outPoints, workPoints);

    return outPoints.length < 4 ? undefined : outPoints.getPoint3dArray();
  }
}
