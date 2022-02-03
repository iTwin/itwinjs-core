/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import type { QParams3d } from "@itwin/core-common";
import { FeatureIndex } from "@itwin/core-common";
import type { Mesh } from "./mesh/MeshPrimitives";

/** @internal */
export class PointCloudArgs {
  public points: Uint16Array | Uint8Array;
  public pointParams: QParams3d;
  public colors: Uint8Array;
  public features: FeatureIndex = new FeatureIndex();
  public voxelSize: number;
  public colorIsBgr: boolean;
  public minimumPointSize: number;

  public constructor(points: Uint16Array | Uint8Array, pointParams: QParams3d, colors: Uint8Array, features: Mesh.Features, voxelSize = -1, colorIsBgr = false, minimumPointSize = 1) {
    this.points = points;
    this.colors = colors;
    this.pointParams = pointParams;
    this.voxelSize = voxelSize;
    this.colorIsBgr = colorIsBgr;
    this.minimumPointSize = minimumPointSize;
    features.toFeatureIndex(this.features);
  }
}
