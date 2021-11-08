/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tools
 */

import {
  DisplayStyle3dSettingsProps, DisplayStyleOverridesOptions, RenderMode, SkyCube, SkySphere, SubCategoryAppearance, SubCategoryOverride,
  ViewFlags, ViewFlagsProperties, WhiteOnWhiteReversalSettings,
} from "@itwin/core-common";
import {
  DisplayStyle3dState, IModelApp, NotifyMessageDetails, OutputMessagePriority, Tool, Viewport,
} from "@itwin/core-frontend";
import { copyStringToClipboard } from "../ClipboardUtilities";
import { parseArgs } from "./parseArgs";
import { parseToggle } from "./parseToggle";

type BooleanFlagName =
  "dimensions" | "patterns" | "weights" | "styles" | "transparency" | "fill" | "textures" | "materials" | "acsTriad" | "grid" | "visibleEdges" |
  "hiddenEdges" | "lighting" | "shadows" | "clipVolume" | "constructions" | "monochrome" | "backgroundMap" | "ambientOcclusion" | "forceSurfaceDiscard";

// Compiler has the info to construct this array for us, but we have no access to it...
const booleanFlagNames: BooleanFlagName[] = [
  "dimensions", "patterns", "weights", "styles", "transparency", "fill", "textures", "materials", "acsTriad", "grid", "visibleEdges",
  "hiddenEdges", "lighting", "shadows", "clipVolume", "constructions", "monochrome", "backgroundMap", "ambientOcclusion", "forceSurfaceDiscard",
];

const lowercaseBooleanFlagNames = booleanFlagNames.map((name) => name.toLowerCase());

/** Modifies the selected viewport's DisplayStyleState.
 * @beta
 */
export abstract class DisplayStyleTool extends Tool {
  protected get require3d() { return false; }
  // Return true if the display style was modified - we will invalidate the viewport's render plan.
  protected abstract execute(vp: Viewport): boolean;
  // Return false if failed to parse.
  protected abstract parse(args: string[]): boolean;

  public override async run(): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp && (!this.require3d || vp.view.is3d()) && this.execute(vp))
      vp.displayStyle = vp.view.displayStyle;

    return true;
  }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp && (!this.require3d || vp.view.is3d()) && this.parse(args))
      return this.run();
    else
      return false;
  }
}

/** Modifies the selected viewport's ViewFlags.
 * The keyin syntax is as follows:
 *  fdt change viewflags flag=value
 * Where 'flag' is one of the BooleanFlagName values, or "renderMode"; and value is an integer.
 * For boolean flags, value is 0 for false or 1 for true. For renderMode, value is one of the RenderMode enum values.
 * Flag names are case-insensitive.
 * @beta
 */
export class ChangeViewFlagsTool extends Tool {
  public static override toolId = "ChangeViewFlags";
  public static override get maxArgs() { return undefined; }
  public static override get minArgs() { return 1; }

  public override async run(vf: ViewFlags, vp?: Viewport): Promise<boolean> {
    if (undefined !== vf && undefined !== vp)
      vp.viewFlags = vf;

    return true;
  }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp || 0 === args.length)
      return true;

    const vf: Partial<ViewFlagsProperties> = { ...vp.viewFlags };
    for (const arg of args) {
      const parts = arg.split("=");
      if (2 !== parts.length)
        continue;

      const value = parseInt(parts[1], 10);
      if (Number.isNaN(value))
        continue;

      const name = parts[0].toLowerCase();
      if (name === "rendermode") {
        switch (value) {
          case RenderMode.SmoothShade:
          case RenderMode.Wireframe:
          case RenderMode.HiddenLine:
          case RenderMode.SolidFill:
            vf.renderMode = value;
            vp.invalidateRenderPlan();
            break;
        }

        continue;
      }

      if (0 !== value && 1 !== value)
        continue;

      const index = lowercaseBooleanFlagNames.indexOf(name);
      if (-1 !== index) {
        const propName = booleanFlagNames[index];
        vf[propName] = 0 !== value;
        vp.invalidateRenderPlan();
      }
    }

    return this.run(new ViewFlags(vf), vp);
  }
}

/** Toggles the skybox.
 * @beta
 */
export class ToggleSkyboxTool extends DisplayStyleTool {
  public static override toolId = "ToggleSkybox";

  public override get require3d() { return true; }

  public parse(_args: string[]) { return true; } // no arguments

  public execute(vp: Viewport): boolean {
    const style = vp.view.displayStyle as DisplayStyle3dState;
    style.environment = style.environment.withDisplay({ sky: !style.environment.displaySky });
    return true;
  }
}

/** Defines a [SkySphere]($common) to apply to the current view.
 * @beta
 */
export class SkySphereTool extends DisplayStyleTool {
  private _image?: string;

  public static override toolId = "SetSkySphere";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return 1; }

  public override get require3d() { return true; }

  public parse(args: string[]) {
    this._image = args[0];
    return true;
  }

  public execute(vp: Viewport): boolean {
    if (this._image && vp.view.is3d()) {
      vp.view.displayStyle.environment = vp.view.displayStyle.environment.clone({
        displaySky: true,
        sky: new SkySphere(this._image),
      });
    }

    return true;
  }
}

/** Defines a [SkyCube]($common) to apply to the current view.
 * @beta
 */
export class SkyCubeTool extends DisplayStyleTool {
  private _images: string[] = [];

  public static override toolId = "SetSkyCube";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return 6; }

  public override get require3d() { return true; }

  public parse(args: string[]) {
    this._images = [...args];
    return true;
  }

  public execute(vp: Viewport): boolean {
    const imgs = this._images;
    if (imgs.length === 0 || !vp.view.is3d())
      return true;

    let top, bottom, left, right, front, back;
    switch (imgs.length) {
      case 1:
        top = bottom = left = right = front = back = imgs[0];
        break;
      case 2:
        top = bottom = imgs[0];
        left = right = front = back = imgs[1];
        break;
      case 3:
        top = bottom = imgs[0];
        left = right = imgs[1];
        front = back = imgs[2];
        break;
      case 4:
        top = imgs[0];
        bottom = imgs[1];
        left = right = imgs[2];
        front = back = imgs[3];
        break;
      case 5:
        top = bottom = imgs[0];
        left = imgs[1];
        right = imgs[2];
        front = imgs[3];
        back = imgs[4];
        break;
      default:
        top = imgs[0];
        bottom = imgs[1];
        left = imgs[2];
        right = imgs[3];
        front = imgs[4];
        back = imgs[5];
        break;
    }

    vp.view.displayStyle.environment = vp.view.displayStyle.environment.clone({
      displaySky: true,
      sky: new SkyCube({ top, bottom, left, right, front, back }),
    });

    return true;
  }
}

/** Outputs (and optionally copies to the clipboard) a "rendering style" as a partial DisplayStyle3dSettingsProps JSON object based
 * on the current view's display style settings.
 * All arguments are optional, of the form "name=value" where `value` is 0 for false or 1 for true. All arguments default to `false` if omitted.
 * @see [DisplayStyleSettings.toOverrides]($common) for details.
 * Arguments:
 *  * `all`: include all settings.
 *  * `imodel`: include iModel-specific settings.
 *  * `project`: include iTwin-specific (formerly known as project) settings.
 *  * `map`: include background map settings.
 *  * `drawingaids`: include drawing aid decoration settings.
 *  * `copy`: copy result to system clipboarad.
 *  * `quote`: format the JSON so it can be parsed directly by [ApplyRenderingStyleTool].
 * @beta
 */
export class SaveRenderingStyleTool extends DisplayStyleTool {
  private _options: DisplayStyleOverridesOptions = {};
  private _copyToClipboard = false;
  private _quote = false;

  public static override toolId = "SaveRenderingStyle";

  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 7; }

  public parse(inputArgs: string[]) {
    const args = parseArgs(inputArgs);
    function getArg(name: string): true | undefined {
      return args.getBoolean(name) ? true : undefined;
    }

    this._options.includeAll = getArg("a");
    this._options.includeIModelSpecific = getArg("i");
    this._options.includeITwinSpecific = getArg("p"); // "p" for backwards compatibility with old "project" terminology
    this._options.includeBackgroundMap = getArg("m");
    this._options.includeDrawingAids = getArg("d");
    this._copyToClipboard = true === getArg("c");
    this._quote = true === getArg("q");

    return true;
  }

  public execute(vp: Viewport): boolean {
    let json = JSON.stringify(vp.displayStyle.settings.toOverrides(this._options));
    if (this._quote)
      json = `"${json.replace(/"/g, '""')}"`;

    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "Rendering style saved", json));
    if (this._copyToClipboard)
      copyStringToClipboard(json);

    return false;
  }
}

/** Given a "rendering style" as a partial DisplayStyle3dSettingsProperties JSON string, apply it to the selected viewport's display style.
 * @see [DisplayStyleSettings.applyOverrides]($common) for details.
 * @beta
 */
export class ApplyRenderingStyleTool extends DisplayStyleTool {
  private _overrides?: DisplayStyle3dSettingsProps;

  public static override toolId = "ApplyRenderingStyle";

  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return 1; }

  public parse(args: string[]) {
    try {
      this._overrides = JSON.parse(args[0]);
      return true;
    } catch {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, "Invalid JSON"));
      return false;
    }
  }

  public execute(vp: Viewport): boolean {
    if (this._overrides)
      vp.overrideDisplayStyle(this._overrides);

    return false;
  }
}

/** Apply appearance overrides to one or more subcategories in the active viewport.
 * @beta
 */
export class OverrideSubCategoryTool extends DisplayStyleTool {
  private _overrideProps: SubCategoryAppearance.Props = {};
  private _subcategoryIds: string[] = [];

  public static override toolId = "OverrideSubCategory";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return 7; }

  public parse(inArgs: string[]): boolean {
    const args = parseArgs(inArgs);
    const ids = args.get("i");
    if (ids)
      this._subcategoryIds = ids.split(",");

    const props = this._overrideProps;
    props.color = args.getInteger("c");
    props.weight = args.getInteger("w");
    props.priority = args.getInteger("p");
    props.transp = args.getFloat("t");
    props.material = args.get("m");

    const visible = args.getBoolean("v");
    props.invisible = typeof visible === "boolean" ? !visible : undefined;
    return true;
  }

  public execute(vp: Viewport): boolean {
    const ovr = SubCategoryOverride.fromJSON(this._overrideProps);
    for (const id of this._subcategoryIds)
      vp.displayStyle.overrideSubCategory(id, ovr);

    return true;
  }
}

/** Set whether background color is ignored when applying white-on-white reversal.
 * @beta
 */
export class WoWIgnoreBackgroundTool extends DisplayStyleTool {
  private _ignore?: boolean;

  public static override toolId = "WoWIgnoreBackground";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 1; }

  public parse(args: string[]): boolean {
    const ignore = parseToggle(args[0]);
    if (typeof ignore === "string")
      return false;

    this._ignore = ignore;
    return true;
  }

  public execute(vp: Viewport): boolean {
    const ignoreBackgroundColor = this._ignore ?? !vp.displayStyle.settings.whiteOnWhiteReversal.ignoreBackgroundColor;
    vp.displayStyle.settings.whiteOnWhiteReversal = WhiteOnWhiteReversalSettings.fromJSON({ ignoreBackgroundColor });
    return true;
  }
}
