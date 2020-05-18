/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { RenderMode, ViewFlags } from "@bentley/imodeljs-common";

/** Adjusts view flags for renderer.
 * @internal
 */
export function normalizeViewFlags(vf: ViewFlags): void {
  switch (vf.renderMode) {
    case RenderMode.Wireframe:
      vf.visibleEdges = vf.hiddenEdges = false;
      break;
    case RenderMode.SmoothShade:
      if (!vf.visibleEdges)
        vf.hiddenEdges = false;

      break;
    case RenderMode.HiddenLine:
    case RenderMode.SolidFill:
      vf.visibleEdges = true;
      vf.transparency = false;
  }
}
