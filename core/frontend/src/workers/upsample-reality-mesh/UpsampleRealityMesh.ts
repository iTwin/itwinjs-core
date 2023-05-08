/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { LowAndHighXY, Range2d } from "@itwin/core-geometry";
import { CloneableRealityMeshParams, RealityMeshParams } from "../../render/RealityMeshParams";
import { CloneableUpsampledRealityMeshParams, UpsampledRealityMeshParams } from "../../render/UpsampleRealityMeshParams";

export interface UpsampleRealityMeshArgs {
  params: CloneableRealityMeshParams;
  uvSampleRange: LowAndHighXY;
}

function upsampleRealityMeshParams(args: UpsampleRealityMeshArgs): UpsampledRealityMeshParams {
  const params = RealityMeshParams.fromStructuredCloneable(args.params);
  const uvSampleRange = Range2d.fromJSON(args.uvSampleRange);
  return undefined as any;
}

onmessage = function(e) {
  const upsampled = upsampleRealityMeshParams(e.data);
  const transfer: Transferable[] = [];
  const mesh = RealityMeshParams.toStructuredCloneable(upsampled.mesh, transfer);
  const heightRange = {
    low: {
      x: upsampled.heightRange.low,
      y: upsampled.heightRange.high,
    },
    high: {
      x: upsampled.heightRange.high,
      y: upsampled.heightRange.high,
    },
  };

  postMessage({ mesh, heightRange }, transfer as any); // ###TODO compiler error on second arg because it thinks Window not worker...
};
