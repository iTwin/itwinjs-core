/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { Range3d, Point3d } from '../../geometry-core/source/Geometry'

/** An iModel file */
export class IModel {
  constructor(public name: string) { }
}

/** A bounding box aligned to the orientation of an Element */
export class ElementAlignedBox extends Range3d {
  public constructor(low: Point3d, high: Point3d) { super(low, high); }

  getLeft(): number { return this.low.x; }
  getFront(): number { return this.low.y; }
  getBottom(): number { return this.low.z; }
  getRight(): number { return this.high.x; }
  getBack(): number { return this.high.y; }
  getTop(): number { return this.high.z; }
  getWidth(): number { return this.xLength(); }
  getDepth(): number { return this.yLength(); }
  getHeight(): number { return this.zLength(); }
};
