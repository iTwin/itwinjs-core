/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Target } from "./Target";
import { DrawParams, ShaderProgramParams } from "./DrawCommand";
import { CachedGeometry } from "./CachedGeometry";

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
