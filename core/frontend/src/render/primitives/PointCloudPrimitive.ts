/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { Range3d } from "@bentley/geometry-core";
import { QPoint3dList, QParams3d } from "@bentley/imodeljs-common";

export class PointCloudArgs {
  public points: QPoint3dList;
  public colors: Uint8Array;
  public constructor(points: QPoint3dList = new QPoint3dList(QParams3d.fromRange(Range3d.createNull())), colors = new Uint8Array()) { this.points = points; this.colors = colors; }
}
