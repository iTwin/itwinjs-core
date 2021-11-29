/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tools
 */

import { CompressedId64Set } from "@itwin/core-bentley";
import {
  DisplayStyle3dSettingsProps, DisplayStyleOverridesOptions, ElementLoadOptions, RenderMode, RenderSchedule, RenderTimelineProps, SkyCube, SkySphere,
  SubCategoryAppearance, SubCategoryOverride, ViewFlags, ViewFlagsProperties, WhiteOnWhiteReversalSettings,
} from "@itwin/core-common";
import {
  DisplayStyle3dState, IModelApp, NotifyMessageDetails, OutputMessagePriority, Tool, Viewport,
} from "@itwin/core-frontend";
import { copyStringToClipboard } from "../ClipboardUtilities";
import { parseArgs } from "./parseArgs";
import { parseToggle } from "./parseToggle";

type BooleanFlagName =
  "dimensions" | "patterns" | "weights" | "styles" | "transparency" | "fill" | "textures" | "materials" | "acsTriad" | "grid" | "visibleEdges" |
  "hiddenEdges" | "lighting" | "shadows" | "clipVolume" | "constructions" | "monochrome" | "backgroundMap" | "ambientOcclusion" | "forceSurfaceDiscard"
  | "wiremesh";

// Compiler has the info to construct this array for us, but we have no access to it...
const booleanFlagNames: BooleanFlagName[] = [
  "dimensions", "patterns", "weights", "styles", "transparency", "fill", "textures", "materials", "acsTriad", "grid", "visibleEdges",
  "hiddenEdges", "lighting", "shadows", "clipVolume", "constructions", "monochrome", "backgroundMap", "ambientOcclusion", "forceSurfaceDiscard",
  "wiremesh",
];

const lowercaseBooleanFlagNames = booleanFlagNames.map((name) => name.toLowerCase());

/** Modifies the selected viewport's DisplayStyleState.
 * @beta
 */
export abstract class DisplayStyleTool extends Tool {
  protected get require3d() { return false; }
  // Return true if the display style was modified - we will invalidate the viewport's render plan.
  protected abstract execute(vp: Viewport): Promise<boolean>;
  // Return false if failed to parse.
  protected abstract parse(args: string[], vp: Viewport): Promise<boolean>;

  public override async run(): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp && (!this.require3d || vp.view.is3d()) && await this.execute(vp))
      vp.displayStyle = vp.view.displayStyle;

    return true;
  }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp && (!this.require3d || vp.view.is3d()) && await this.parse(args, vp))
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

  public async parse(_args: string[]): Promise<boolean> { return true; } // no arguments

  public async execute(vp: Viewport) {
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

  public async parse(args: string[]) {
    this._image = args[0];
    return true;
  }

  public async execute(vp: Viewport) {
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

  public async parse(args: string[]) {
    this._images = [...args];
    return true;
  }

  public async execute(vp: Viewport) {
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
 *  * `copy`: copy result to system clipboard.
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

  public async parse(inputArgs: string[]) {
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

  public async execute(vp: Viewport) {
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

  public async parse(args: string[]) {
    try {
      this._overrides = JSON.parse(args[0]);
      return true;
    } catch {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, "Invalid JSON"));
      return false;
    }
  }

  public async execute(vp: Viewport) {
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

  public async parse(inArgs: string[]) {
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

  public async execute(vp: Viewport) {
    const ovr = SubCategoryOverride.fromJSON(this._overrideProps);
    for (const id of this._subcategoryIds)
      vp.displayStyle.overrideSubCategory(id, ovr);

    return true;
  }
}

/** Query the schedule script JSON from an element.
 * @beta
 */
export class QueryScheduleScriptTool extends DisplayStyleTool {
  private _sourceId?: string;
  private _action: "copy" | "break" = "copy";
  private _includeElementIds = false;
  private _countElementIds = false;
  private _expandElementIds = false;

  public static override toolId = "QueryScheduleScript";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 3; }

  public async parse(input: string[], vp: Viewport) {
    const args = parseArgs(input);
    this._sourceId = args.get("i") ?? vp.displayStyle.scheduleScriptReference?.sourceId;
    if (!this._sourceId)
      return false;

    const action = args.get("a") ?? "";
    this._action = action.length > 0 && "b" === action[0].toLowerCase() ? "break" : "copy";

    this._includeElementIds = this._countElementIds = this._expandElementIds = false;
    const ids = args.get("e");
    if (ids && ids.length > 0) {
      switch (ids[0].toLowerCase()) {
        case "i":
          this._includeElementIds = true;
          break;
        case "c":
          this._includeElementIds = this._countElementIds = true;
          break;
        case "e":
          this._includeElementIds = this._expandElementIds = true;
          break;
      }
    }

    return true;
  }

  public async execute(vp: Viewport) {
    if (!this._sourceId || !this._action)
      return false;

    const opts: ElementLoadOptions = {
      displayStyle: { omitScheduleScriptElementIds: !this._includeElementIds },
      renderTimeline: { omitScriptElementIds: !this._includeElementIds },
    };

    let script;
    const props = await vp.iModel.elements.loadProps(this._sourceId, opts) as any;
    if (props.script)
      script = JSON.parse((props.script as RenderTimelineProps).script) as RenderSchedule.ScriptProps;
    else if (props.jsonProperties?.styles?.scheduleScript)
      script = props.jsonProperties.styles.scheduleScript as RenderSchedule.ScriptProps;

    if (!script)
      return false;

    if (this._countElementIds || this._expandElementIds) {
      for (const model of script) {
        for (const elem of model.elementTimelines) {
          const elemIds = typeof elem.elementIds === "string" ? CompressedId64Set.decompressArray(elem.elementIds) : elem.elementIds;
          if (this._countElementIds)
            elem.elementIds = elemIds.length as any;
          else
            elem.elementIds = elemIds;
        }
      }
    }

    if (this._action === "break")
      debugger; // eslint-disable-line no-debugger
    else
      copyStringToClipboard(JSON.stringify(script, null, 2));

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

  public async parse(args: string[]) {
    const ignore = parseToggle(args[0]);
    if (typeof ignore === "string")
      return false;

    this._ignore = ignore;
    return true;
  }

  public async execute(vp: Viewport) {
    const ignoreBackgroundColor = this._ignore ?? !vp.displayStyle.settings.whiteOnWhiteReversal.ignoreBackgroundColor;
    vp.displayStyle.settings.whiteOnWhiteReversal = WhiteOnWhiteReversalSettings.fromJSON({ ignoreBackgroundColor });
    return true;
  }
}

/** Toggle whether surfaces display with overlaid wiremesh in the active viewport.
 * @see [ViewFlags.wiremesh]($common).
 * @beta
 */
export class ToggleWiremeshTool extends DisplayStyleTool {
  private _enable?: boolean;

  public static override toolId = "ToggleWiremesh";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 1; }

  public async parse(args: string[]) {
    const enable = parseToggle(args[0]);
    if (typeof enable === "string")
      return false;

    this._enable = enable;
    return true;
  }

  public async execute(vp: Viewport) {
    vp.viewFlags = vp.viewFlags.with("wiremesh", this._enable ?? !vp.viewFlags.wiremesh);
    return true;
  }
}
