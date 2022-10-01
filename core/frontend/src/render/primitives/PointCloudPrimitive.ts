/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { FeatureIndex, QParams3d } from "@itwin/core-common";
import { Mesh } from "./mesh/MeshPrimitives";

/** @internal */
export class PointCloudArgs {
  public points: Uint16Array | Uint8Array;
  public pointParams: QParams3d;
  public colors: Uint8Array;
  public features: FeatureIndex = new FeatureIndex();
  public voxelSize: number;
  public colorIsBgr: boolean;

  public constructor(points: Uint16Array | Uint8Array, pointParams: QParams3d, colors: Uint8Array, features: Mesh.Features, voxelSize = -1, colorIsBgr = false) {
    this.points = points;
    this.colors = colors;
    this.pointParams = pointParams;
    this.voxelSize = voxelSize;
    this.colorIsBgr = colorIsBgr;
    features.toFeatureIndex(this.features);
  }
}
