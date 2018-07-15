/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { Range3d } from "@bentley/geometry-core";
import { QParams3d } from "@bentley/imodeljs-common";

export class PointCloudArgs {
  public points: Uint16Array;
  public pointParams: QParams3d;
  public colors: Uint8Array;
  public constructor(points: Uint16Array = new Uint16Array(), pointParams = QParams3d.fromRange(Range3d.createNull()), colors = new Uint8Array()) { this.points = points; this.pointParams = pointParams, this.colors = colors; }
}
