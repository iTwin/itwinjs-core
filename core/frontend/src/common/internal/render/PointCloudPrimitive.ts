/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { FeatureIndex, QParams3d } from "@itwin/core-common";

/** @internal */
export interface PointCloudArgs {
  positions: Uint8Array | Uint16Array | Float32Array;
  qparams: QParams3d;
  colors: Uint8Array;
  features: FeatureIndex;
  voxelSize: number;
  colorFormat: "bgr" | "rgb";
}
