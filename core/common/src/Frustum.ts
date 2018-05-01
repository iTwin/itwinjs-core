/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Views */

import { Vector3d, Point3d, LowAndHighXYZ, LowAndHighXY, Range3d, Transform, Geometry, Map4d } from "@bentley/geometry-core";

/** The 8 corners of the NPC cube. */
export const enum Npc {
  _000 = 0,  // Left bottom rear
  _100 = 1,  // Right bottom rear
  _010 = 2,  // Left top rear
  _110 = 3,  // Right top rear
  _001 = 4,  // Left bottom front
  _101 = 5,  // Right bottom front
  _011 = 6,  // Left top front
  _111 = 7,  // Right top front

  LeftBottomRear = 0,
  RightBottomRear = 1,
  LeftTopRear = 2,
  RightTopRear = 3,
  LeftBottomFront = 4,
  RightBottomFront = 5,
  LeftTopFront = 6,
  RightTopFront = 7,
  CORNER_COUNT = 8,
}

// tslint:disable-next-line:variable-name
export const NpcCorners = [
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

// tslint:disable-next-line:variable-name
export const NpcCenter = new Point3d(.5, .5, .5);
Object.freeze(NpcCenter);

/**
 * The region of physical (3d) space that appears in a view. It forms the field-of-view of a camera.
 * It is stored as 8 points, in NpcCorner order, that must define a truncated pyramid.
 */
export class Frustum {
  public readonly points: Point3d[] = [];
  /** constructor for Frustum. Members are initialized to the Npc cube. */
  public constructor() { for (let i = 0; i < 8; ++i) this.points[i] = NpcCorners[i].clone(); }
  public initNpc() { for (let i = 0; i < 8; ++i) Point3d.createFrom(NpcCorners[i], this.points[i]); return this; }
  public getCorner(i: number) { return this.points[i]; }
  public getCenter(): Point3d { return this.getCorner(Npc.RightTopFront).interpolate(0.5, this.getCorner(Npc.LeftBottomRear)); }
  public distance(corner1: number, corner2: number): number { return this.getCorner(corner1).distance(this.getCorner(corner2)); }
  public getFraction(): number { return Geometry.safeDivideFraction(this.distance(Npc.LeftTopFront, Npc.RightBottomFront), this.distance(Npc.LeftTopRear, Npc.RightBottomRear), 0); }
  public multiply(trans: Transform): void { trans.multiplyPoint3dArrayInPlace(this.points); }
  public translate(offset: Vector3d): void { for (const pt of this.points) pt.plus(offset); }
  public transformBy(trans: Transform, result?: Frustum): Frustum { result = result ? result : new Frustum(); trans.multiplyPoint3dArray(this.points, result.points); return result; }
  public toRange(range?: Range3d): Range3d { range = range ? range : new Range3d(); Range3d.createArray(this.points, range); return range; }
  public clone(result?: Frustum): Frustum { result = result ? result : new Frustum(); result.setFrom(this); return result; }
  public setFrom(other: Frustum) { for (let i = 0; i < 8; ++i) { this.points[i].setFrom(other.points[i]); } }
  public isSame(other: Frustum): boolean { for (let i = 0; i < 8; ++i) { if (!this.points[i].isAlmostEqual(other.points[i])) return false; } return true; }
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

  public toDMap4d(): Map4d | undefined {
    const org = this.getCorner(Npc.LeftBottomRear);
    const xVec = org.vectorTo(this.getCorner(Npc.RightBottomRear));
    const yVec = org.vectorTo(this.getCorner(Npc.LeftTopRear));
    const zVec = org.vectorTo(this.getCorner(Npc.LeftBottomFront));
    return Map4d.createVectorFrustum(org, xVec, yVec, zVec, this.getFraction());
  }

  public invalidate(): void { for (let i = 0; i < 8; ++i) this.points[i].set(0, 0, 0); }
  public equals(rhs: Frustum): boolean {
    for (let i = 0; i < 8; ++i) {
      if (!this.points[i].isExactEqual(rhs.points[i]))
        return false;
    }
    return true;
  }

  /** Initialize this Frustum from a Range */
  public initFromRange(range: LowAndHighXYZ | LowAndHighXY): void {
    const getZ = (arg: any): number => arg.z !== undefined ? arg.z : 0;
    const pts = this.points;
    pts[0].x = pts[3].x = pts[4].x = pts[7].x = range.low.x;
    pts[1].x = pts[2].x = pts[5].x = pts[6].x = range.high.x;
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
  public hasMirror(): boolean {
    const pts = this.points;
    const u = pts[Npc._000].vectorTo(pts[Npc._001]);
    const v = pts[Npc._000].vectorTo(pts[Npc._010]);
    const w = pts[Npc._000].vectorTo(pts[Npc._100]);
    return (u.tripleProduct(v, w) > 0);
  }

  /** make sure the frustum point order does not include mirroring. If so, reverse the order. */
  public fixPointOrder() {
    if (!this.hasMirror())
      return;

    // frustum has mirroring, reverse points
    const pts = this.points;
    for (let i = 0; i < 8; i += 2) {
      const tmpPoint = pts[i];
      pts[i] = pts[i + 1];
      pts[i + 1] = tmpPoint;
    }
  }
}
