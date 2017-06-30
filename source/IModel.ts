/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Point3d, Range3d, YawPitchRollAngles } from "../../geometry-core/source/Geometry";

/** An iModel file */
export class IModel {
  constructor(public name: string) { }
}

/** A bounding box aligned to the orientation of an Element */
export class ElementAlignedBox3d extends Range3d {
  public constructor(low: Point3d, high: Point3d) { super(low.x, low.y, low.z, high.x, high.y, high.z); }

  public getLeft(): number { return this.low.x; }
  public getFront(): number { return this.low.y; }
  public getBottom(): number { return this.low.z; }
  public getRight(): number { return this.high.x; }
  public getBack(): number { return this.high.y; }
  public getTop(): number { return this.high.z; }
  public getWidth(): number { return this.xLength(); }
  public getDepth(): number { return this.yLength(); }
  public getHeight(): number { return this.zLength(); }
}

export class GeometryStream {
  public geomStream: ArrayBuffer;

  // return false if this GeometryStream is empty.
  public hasGeometry(): boolean { return this.geomStream.byteLength !== 0 }

}

export class Placement3d {
  public constructor(public origin: Point3d, public angles: YawPitchRollAngles, public boundingBox: ElementAlignedBox3d) { }
}
