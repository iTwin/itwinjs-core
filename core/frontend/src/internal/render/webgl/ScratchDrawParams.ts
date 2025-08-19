/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { CachedGeometry } from "./CachedGeometry";
import { DrawParams, ShaderProgramParams } from "./DrawCommand";
import { Target } from "./Target";

interface ScratchDrawParams {
  progParams: ShaderProgramParams;
  drawParams: DrawParams;
};

let scratchDrawParams: ScratchDrawParams | undefined;

/** @internal */
export function getDrawParams(target: Target, geometry: CachedGeometry): DrawParams {
  if (undefined === scratchDrawParams) {
    scratchDrawParams = {
      progParams: new ShaderProgramParams(),
      drawParams: new DrawParams(),
    };
  }

  scratchDrawParams.progParams.init(target);
  scratchDrawParams.drawParams.init(scratchDrawParams.progParams, geometry);
  return scratchDrawParams.drawParams;
}

/** @internal */
export function freeDrawParams(): void {
  scratchDrawParams = undefined;
}
