/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { RenderGraphic, RenderMemory } from "@itwin/core-frontend";
import { Range3d } from "@itwin/core-geometry";

/** @internal */
export class CesiumGraphic extends RenderGraphic {
  /** The geometry data from the original iTwin.js decoration */
  public readonly geometries?: any[];
  /** The type of geometry (point-string, polyline, mesh, etc.) */
  public readonly geometryType?: string;

  constructor(geometries?: any[], geometryType?: string) {
    super();
    this.geometries = geometries;
    this.geometryType = geometryType;
  }
  // ##TODO implement dispose and statistics, if necessary.
  public dispose() {}
  public collectStatistics(_stats: RenderMemory.Statistics) {}

  /** Extend `range` to include the bounding box of this graphic, including any child graphics.
  * @internal
  */
  public unionRange(_range: Range3d) {
    // ###TODO need to figure out range of Cesium graphics.
  }
}
