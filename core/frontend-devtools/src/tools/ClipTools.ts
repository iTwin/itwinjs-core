/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tools
 */

import {
  ClipIntersectionStyle, ClipStyle, ClipStyleProps, ColorByName, ColorDef, CutStyleProps, LinePixels, RenderMode, RgbColor,
} from "@itwin/core-common";
import { IModelApp, Tool, Viewport } from "@itwin/core-frontend";
import { parseToggle } from "./parseToggle";
import { parseBoolean } from "./parseBoolean";
import { DisplayStyleTool } from "./DisplayStyleTools";

/** This tool specifies or un-specifies a clip color to use for pixels inside or outside the clip region.
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
 * @beta
 */
export class ClipColorTool extends Tool {
  public static override toolId = "ClipColorTool";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return 2; }

  private _clearClipColors() {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp) {
      const props = vp.displayStyle.settings.clipStyle.toJSON() ?? {};
      props.insideColor = props.outsideColor = undefined;
      vp.displayStyle.settings.clipStyle = ClipStyle.fromJSON(props);
    }
  }

  private setClipColor(colStr: string, which: "insideColor" | "outsideColor") {
    const vp = IModelApp.viewManager.selectedView;
    if (vp) {
      const props = vp.displayStyle.settings.clipStyle.toJSON() ?? {};
      props[which] = colStr === "clear" ? undefined : RgbColor.fromColorDef(ColorDef.fromString(colStr));
      vp.displayStyle.settings.clipStyle = ClipStyle.fromJSON(props);
    }
  }

  /** This runs the tool using the given arguments, specifying or unspecifying a clip color to use for pixels inside or outside the clip region.
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
   * @beta
   */
  public override async parseAndRun(...args: string[]): Promise<boolean> {
    if (1 === args.length) {
      if (args[0] === "clear")
        this._clearClipColors();

      return true;
    }

    const which = args[0];
    if (which === "inside" || which === "outside")
      this.setClipColor(args[1], "inside" === which ? "insideColor" : "outsideColor");

    return true;
  }
}

/** This tool specifies or un-specifies a color and width to use for pixels within the specified width of a clip plane.
 * Arguments can be:
 * - off
 * - default
 * - color   <color string>
 * - width   <number>
 * <color string> must be in one of the following forms:
 * "rgb(255,0,0)"
 * "rgba(255,0,0,255)"
 * "rgb(100%,0%,0%)"
 * "hsl(120,50%,50%)"
 * "#rrbbgg"
 * "blanchedAlmond" (see possible values from [[ColorByName]]). Case insensitive.
 * @see [ColorDef]
 * @beta
 */
export class ClipIntersectionTool extends Tool {
  public static override toolId = "ClipIntersectionTool";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 4; }

  private _toggleIntersectionStyle(toggle: boolean) {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp) {
      const props = vp.displayStyle.settings.clipStyle.toJSON() ?? {};
      props.colorizeIntersection = toggle;
      vp.displayStyle.settings.clipStyle = ClipStyle.fromJSON(props);
    }
  }

  private _defaultClipIntersection() {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp) {
      const props = vp.displayStyle.settings.clipStyle.toJSON() ?? {};
      if (!props.intersectionStyle) {
        props.intersectionStyle = ClipIntersectionStyle.defaults;
      } else {
        props.intersectionStyle.color = RgbColor.fromColorDef(ColorDef.white);
        props.intersectionStyle.width = 1;
      }
      vp.displayStyle.settings.clipStyle = ClipStyle.fromJSON(props);
    }
  }

  private setClipIntersection(colStr: string, width: number) {
    const vp = IModelApp.viewManager.selectedView;
    if (vp) {
      const props = vp.displayStyle.settings.clipStyle.toJSON() ?? {};

      if (!props.intersectionStyle) {
        props.intersectionStyle = ClipIntersectionStyle.defaults;
      }
      if (colStr) {
        props.intersectionStyle.color = RgbColor.fromColorDef(ColorDef.fromString(colStr));
      }
      if (width) {
        props.intersectionStyle.width = width;
      }

      vp.displayStyle.settings.clipStyle = ClipStyle.fromJSON(props);
    }
  }

  /** This runs the tool using the given arguments, specifying or unspecifying a color and width to use for pixels within the specified width of a clip plane.
   * Arguments can be:
   * - off
   * - default
   * - color   <color string>
   * - width   <number>
   * <color string> must be in one of the following forms:
   * "rgb(255,0,0)"
   * "rgba(255,0,0,255)"
   * "rgb(100%,0%,0%)"
   * "hsl(120,50%,50%)"
   * "#rrbbgg"
   * "blanchedAlmond" (see possible values from [[ColorByName]]). Case insensitive.
   * @beta
   */
  public override async parseAndRun(...args: string[]): Promise<boolean> {
    if (args[0] === "off") {
      this._toggleIntersectionStyle(false);
      return true;
    }

    this._toggleIntersectionStyle(true);
    if (args[0] === "default") {
      this._defaultClipIntersection();
      return true;
    }

    args[0] === "color" ? this.setClipIntersection(args[1], +args[3]) : this.setClipIntersection(args[3], +args[1]);
    return true;
  }
}

/** Controls a view state's view details' flag for producing cut geometry for a clip style.
 * @beta
 */
export class ToggleSectionCutTool extends Tool {
  public static override toolId = "ToggleSectionCut";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 1; }

  /** This method runs the tool, controlling a view state's view details' flag for producing cut geometry for a clip style.
   * @param produceCutGeometry whether to produce cut geometry
   */
  public override async run(produceCutGeometry?: boolean): Promise<boolean> {
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

  /** Executes this tool's run method with args[0] containing `produceCutGeometry`.
   * @see [[run]]
   */
  public override async parseAndRun(...args: string[]): Promise<boolean> {
    const enable = parseToggle(args[0]);
    if (typeof enable !== "string")
      await this.run(enable);

    return true;
  }
}

/** Simple tool that toggles a hard-coded clip style overriding various aspects of the cut geometry appearance.
 * @beta
 */
export class TestClipStyleTool extends DisplayStyleTool {
  public static override toolId = "TestClipStyle";
  public static override get maxArgs() { return 2; }
  public static override get minArgs() { return 1; }

  private _useStyle = false;
  private _style?: CutStyleProps;

  protected override get require3d() { return true; }

  protected async parse(args: string[]): Promise<boolean> {
    this._useStyle = parseBoolean(args[0]) ?? false;
    if (this._useStyle && args.length > 1)
      this._style = JSON.parse(args[1]);
    return true;
  }

  protected async execute(vp: Viewport) {
    const props: ClipStyleProps = { produceCutGeometry: true };
    if (this._useStyle) {
      if (this._style)
        props.cutStyle = this._style;
      else
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
