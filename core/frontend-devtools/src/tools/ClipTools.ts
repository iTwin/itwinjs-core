/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tools
 */

import {
  ClipStyle,
  ClipStyleProps,
  ColorByName,
  ColorDef,
  LinePixels,
  RenderMode,
} from "@bentley/imodeljs-common";
import { IModelApp, Tool, Viewport } from "@bentley/imodeljs-frontend";
import { parseToggle } from "./parseToggle";
import { parseBoolean } from "./parseBoolean";
import { DisplayStyleTool } from "./DisplayStyleTools";

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
    if (undefined !== vp)
      vp.insideClipColor = colStr === "clear" ? undefined : ColorDef.fromString(colStr);
  }

  private _setOutsideClipColor(colStr: string) {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp)
      vp.outsideClipColor = colStr === "clear" ? undefined : ColorDef.fromString(colStr);
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

/** Controls a [ViewState]($frontend)'s [ViewDetails]($frontend)'s [ClipStyle.produceCutGeometry]($common) flag.
 * @alpha
 */
export class ToggleSectionCutTool extends Tool {
  public static toolId = "ToggleSectionCut";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }

  public run(produceCutGeometry?: boolean): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (vp) {
      const style = vp.view.displayStyle.settings.clipStyle;
      produceCutGeometry = produceCutGeometry ?? !style.produceCutGeometry;
      if (produceCutGeometry !== style.produceCutGeometry) {
        const json = {
          ...vp.view.displayStyle.settings.clipStyle.toJSON(),
          produceCutGeometry,
        };

        vp.view.displayStyle.settings.clipStyle = ClipStyle.fromJSON(json);
        vp.invalidateScene();
      }
    }

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const enable = parseToggle(args[0]);
    if (typeof enable !== "string")
      this.run(enable);

    return true;
  }
}

/** Simple tool that toggles a hard-coded [ClipStyle]($frontend) overriding various aspects of the cut geometry appearance.
 * @alpha
 */
export class TestClipStyleTool extends DisplayStyleTool {
  public static toolId = "TestClipStyle";
  public static get maxArgs() { return 1; }
  public static get minArgs() { return 1; }

  private _useStyle = false;

  protected get require3d() { return true; }

  protected parse(args: string[]): boolean {
    this._useStyle = parseBoolean(args[0]) ?? false;
    return true;
  }

  protected execute(vp: Viewport): boolean {
    const props: ClipStyleProps = { produceCutGeometry: true };
    if (this._useStyle) {
      props.cutStyle = {
        viewflags: {
          renderMode: RenderMode.SmoothShade,
          visibleEdges: true,
          hiddenEdges: false,
        },
        appearance: {
          rgb: { r: 0xff, g: 0x7f, b: 0 },
          transparency: 0.5,
          nonLocatable: true,
        },
        hiddenLine: {
          visible: {
            ovrColor: true,
            color: ColorByName.blue,
            pattern: LinePixels.Solid,
            width: 3,
          },
        },
      };
    }

    vp.displayStyle.settings.clipStyle = ClipStyle.fromJSON(props);
    vp.invalidateRenderPlan();
    vp.setFeatureOverrideProviderChanged();

    return true;
  }
}
