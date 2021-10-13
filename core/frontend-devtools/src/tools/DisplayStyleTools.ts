/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tools
 */

import {
  DisplayStyle3dSettingsProps, DisplayStyleOverridesOptions, ElementLoadOptions, RenderMode, RenderSchedule, RenderTimelineProps, SubCategoryAppearance, SubCategoryOverride, ViewFlags,
} from "@bentley/imodeljs-common";
import {
  DisplayStyle3dState, Environment, IModelApp, NotifyMessageDetails, OutputMessagePriority, Tool, Viewport,
} from "@bentley/imodeljs-frontend";
import {CompressedId64Set} from "../../../bentley/lib/CompressedId64Set";
import { copyStringToClipboard } from "../ClipboardUtilities";
import { parseArgs } from "./parseArgs";

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
  protected abstract parse(args: string[], vp: Viewport): boolean;

  public override run(): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp && (!this.require3d || vp.view.is3d()) && this.execute(vp))
      vp.displayStyle = vp.view.displayStyle;

    return true;
  }

  public override parseAndRun(...args: string[]): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp && (!this.require3d || vp.view.is3d()) && this.parse(args, vp))
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

  public override run(vf: ViewFlags, vp?: Viewport): boolean {
    if (undefined !== vf && undefined !== vp)
      vp.viewFlags = vf;

    return true;
  }

  public override parseAndRun(...args: string[]): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp || 0 === args.length)
      return true;

    const vf = vp.viewFlags.clone();
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

    return this.run(vf, vp);
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
    style.environment = new Environment({ sky: { display: !style.environment.sky.display } });
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
 *  * `project`: include project-specific settings.
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
    this._options.includeProjectSpecific = getArg("p");
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

/** Given a "rendering style" as a partial DispalyStyle3dSettingsProperties JSON string, apply it to the selected viewport's display style.
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

export class QueryScheduleScriptTool extends DisplayStyleTool {
  private _sourceId?: string;
  private _action: "copy" | "break" = "copy";
  private _includeElementIds = false;
  private _countElementIds = false;
  private _expandElementIds = false;

  public static override toolId = "QueryScheduleScript";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 3; }

  public parse(input: string[], vp: Viewport): boolean {
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

  public execute(vp: Viewport): boolean {
    if (!this._sourceId || !this._action)
      return false;

    this._execute(vp);
    return true;
  }

  private async _execute(vp: Viewport): Promise<void> {
    const opts: ElementLoadOptions = {
      displayStyle: { omitScheduleScriptElementIds: !this._includeElementIds },
      renderTimeline: { omitScriptElementIds: !this._includeElementIds },
    };

    let script;
    const props = await vp.iModel.elements.loadProps(this._sourceId!, opts) as any;
    if (props.script)
      script = JSON.parse((props.script as RenderTimelineProps).script) as RenderSchedule.ScriptProps;
    else if (props.jsonProperties?.styles?.scheduleScript)
      script = props.jsonProperties.styles.scheduleScript as RenderSchedule.ScriptProps;

    if (!script)
      return;

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
      debugger;
    else
      copyStringToClipboard(JSON.stringify(script, null, 2));
  }
}
