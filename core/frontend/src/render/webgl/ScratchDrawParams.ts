/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { CachedGeometry } from "./CachedGeometry";
import { DrawParams, ShaderProgramParams } from "./DrawCommand";
import type { Target } from "./Target";

let progParams: ShaderProgramParams | undefined;
let drawParams: DrawParams | undefined;

/** @internal */
export function getDrawParams(target: Target, geometry: CachedGeometry): DrawParams {
  if (undefined === progParams) {
    progParams = new ShaderProgramParams();
    drawParams = new DrawParams();
  }

  progParams.init(target);
  drawParams!.init(progParams, geometry);
  return drawParams!;
}

/** @internal */
export function freeDrawParams(): void {
  progParams = undefined;
  drawParams = undefined;
}
