/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { LinePixels } from "@itwin/core-common";

/** Map a LinePixels value to an integer in [0..9] that can be used by shaders to index into the corresponding pixel pattern.
 * This is used for feature overrides, including those defined by InstancedGraphicParams.
 */
export function lineCodeFromLinePixels(pixels: LinePixels): number {
  switch (pixels) {
    case LinePixels.Code0: return 0;
    case LinePixels.Code1: return 1;
    case LinePixels.Code2: return 2;
    case LinePixels.Code3: return 3;
    case LinePixels.Code4: return 4;
    case LinePixels.Code5: return 5;
    case LinePixels.Code6: return 6;
    case LinePixels.Code7: return 7;
    case LinePixels.HiddenLine: return 8;
    case LinePixels.Invisible: return 9;
    default: return 0;
  }
}
