/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Point3d, Vector3d } from "@bentley/geometry-core/lib/PointVector";

export const enum PolylineParam {
  kNone = 0,
  kSquare = 1 * 3,
  kMiter = 2 * 3,
  kMiterInsideOnly = 3 * 3,
  kJointBase = 4 * 3,
  kNegatePerp = 8 * 3,
  kNegateAlong = 16 * 3,
  kNoneAdjWt = 32 * 3,
}

export class PolyLineParamVertex {
  public point: Point3d;
  public prevPoint: Point3d;
  public nextPoint: Point3d;
  public color: number;
  public attrib: number;
  public length: number;
  public isSegmentStart: boolean;
  public isPolylineStartOrEnd: boolean;

  public constructor(isSegmentStart: boolean, isPolylineStartOrEnd: boolean, point: Point3d,
                     prevPoint: Point3d, nextPoint: Point3d, color: number, attrib: number, length: number) {
    this.isSegmentStart = isSegmentStart;
    this.isPolylineStartOrEnd = isPolylineStartOrEnd;
    this.point = point;
    this.prevPoint = prevPoint;
    this.nextPoint = nextPoint;
    this.color = color;
    this.attrib = attrib;
    this.length = length;
  }

  public DotProduct(): number {
    const prevDir: Vector3d = Vector3d.createStartEnd (this.prevPoint, this.point);
    prevDir.normalizeInPlace ();
    const nextDir: Vector3d = Vector3d.createStartEnd (this.nextPoint, this.point);
    nextDir.normalizeInPlace ();
    return prevDir.dotProduct (nextDir);
  }

  public GetParam(negatePerp: boolean, adjacentToJoint: boolean = false, joint: boolean = false, noDisplacement: boolean = false): PolylineParam {
    if (joint)
      return PolylineParam.kJointBase;

    let param: PolylineParam = this.isPolylineStartOrEnd ? PolylineParam.kSquare : PolylineParam.kMiter;

    if (noDisplacement)
      param = PolylineParam.kNoneAdjWt; // prevent getting tossed before width adjustment
    else if (adjacentToJoint)
      param = PolylineParam.kMiterInsideOnly;

    let adjust: PolylineParam = PolylineParam.kNone;
    if (negatePerp)
      adjust = PolylineParam.kNegatePerp;

    if (!this.isSegmentStart)
      adjust += PolylineParam.kNegateAlong;

    param = adjust + param;
    return param;
  }
}
