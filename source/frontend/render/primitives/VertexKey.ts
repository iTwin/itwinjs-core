/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Point3d } from "@bentley/geometry-core";
import { QPoint3d } from "../QPoint";

export class VertexKeyNormalAndPosition {
  public readonly data = new Uint16Array(4);
  constructor(pos: QPoint3d, normal: number) {
    this.data[0] = normal;
    this.data[1] = pos.x;
    this.data[2] = pos.y;
    this.data[3] = pos.z;
  }
  public get position(): Point3d { return new Point3d(this.data[1], this.data[2], this.data[3]); }
  public get normal(): number { return this.data[0]; }
}
