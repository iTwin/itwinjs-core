/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ClipPlaneSet } from "@bentley/geometry-core/lib/numerics/ClipPlanes";
import { Point2d, Transform } from "@bentley/geometry-core/lib/PointVector";

export class ClipPrimitive {
  public clipPlanes?: ClipPlaneSet;
  public invisible: boolean;

  public constructor(planeSet?: ClipPlaneSet, invisible: boolean = false) {
    this.clipPlanes = planeSet;
    this.invisible = invisible;
  }

  public toJSON(): any {
    const val: any = {};
    val.planes = {};
    if (this.clipPlanes)
      val.planes.clips = this.clipPlanes.toJSON();
    if (this.invisible)
      val.planes.invisible = true;
    return val;
  }

  public static fromJSON(json: any): ClipPrimitive {
    if (typeof (json.shape !== "undefined"))
      return ClipShape.fromShapeJSON(json.shape);
    if (typeof (json.planes) !== "undefined")
      return new ClipPrimitive(ClipPlaneSet.fromJSON(json.planes), !!json.planes.invisible);

    return new ClipPrimitive(new ClipPlaneSet());
  }
}

export class ClipShape extends ClipPrimitive {

  public constructor(public points: Point2d[], public trans?: Transform, public zLow?: number, public zHigh?: number, public isMask: boolean = false) { super(); }

  public toJSON(): any {
    const val: any = {};
    val.shape = {};

    val.shape.points = [];
    for (const pt of this.points)
      val.shape.points.push(pt.toJSON);

    if (this.invisible)
      val.shape.invisible = true;

    if (this.trans && !this.trans.isIdentity())
      val.shape.trans = this.trans.toJSON();

    if (this.isMask)
      val.shape.isMask = true;

    if (typeof (this.zLow) !== "undefined")
      val.shape.zlow = this.zLow;

    if (typeof (this.zHigh) !== "undefined")
      val.shape.zhigh = this.zHigh;

    return val;
  }

  public static fromShapeJSON(json: any): ClipShape {
    const pts = [];
    for (const pt of json.points)
      pts.push(Point2d.fromJSON(pt));

    return new ClipShape(pts, Transform.fromJSON(json.trans), json.zlow, json.zhigh, !!json.isMask);
  }
}

export class ClipVector {
  public clips: ClipPrimitive[] = [];

  public isValid(): boolean { return this.clips.length > 0; }
  public toJSON(): any {
    if (!this.isValid())
      return undefined;

    const val: any = {};
    for (const clip of this.clips)
      val.push(clip.toJSON());

    return val;
  }

  public static fromJSON(json: any): ClipVector {
    const vec = new ClipVector();
    for (const clip of json)
      vec.clips.push(ClipPrimitive.fromJSON(clip));
    return vec;
  }
}
