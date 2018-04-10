/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Point3d } from "@bentley/geometry-core";

export class StrokesPointList {
  public points: Point3d[];
  constructor(public startDistance: number = 0, public rangeCenter: Point3d = Point3d.createZero(), points: Point3d[] = []) { this.points = [...points]; }
}

export class StrokesPointLists extends Array<StrokesPointList> { constructor(...args: StrokesPointList[]) { super(...args); } }
