/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tools
 */

import { ColorDef } from "@bentley/imodeljs-common";
import { IModelApp, Tool } from "@bentley/imodeljs-frontend";

/** Specify or unspecify a clip color to use for pixels inside or outside the clip region.
 * Arguments can be:
 * - clear
 * - inside   <color string> | clear
 * - outside  <color string> | clear
 * <color string> must be in one of the following forms:
 * "rgb(255,0,0)"
 * "rgba(255,0,0,255)"
 * "rgb(100%,0%,0%)"
 * "hsl(120,50%,50%)"
 * "#rrbbgg"
 * "blanchedAlmond" (see possible values from [[ColorByName]]). Case insensitive.
 * @see [ColorDef]
 * @alpha
 */
export class ClipColorTool extends Tool {
  public static toolId = "ClipColorTool";
  public static get minArgs() { return 1; }
  public static get maxArgs() { return 2; }

  private _clearClipColors() {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp) {
      vp.insideClipColor = undefined;
      vp.outsideClipColor = undefined;
    }
  }

  private _setInsideClipColor(colStr: string) {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp) {
      if (colStr === "clear")
        vp.insideClipColor = undefined;
      else
        vp.insideClipColor = new ColorDef(colStr);
    }
  }

  private _setOutsideClipColor(colStr: string) {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp) {
      if (colStr === "clear")
        vp.outsideClipColor = undefined;
      else
        vp.outsideClipColor = new ColorDef(colStr);
    }
  }

  public parseAndRun(...args: string[]): boolean {
    if (1 === args.length) {
      if (args[0] === "clear") {
        this._clearClipColors();
        return true;
      }
      return false;
    }

    if (args[0] === "inside")
      this._setInsideClipColor(args[1]);
    else if (args[0] === "outside")
      this._setOutsideClipColor(args[1]);
    else
      return false;
    return true;
  }
}
