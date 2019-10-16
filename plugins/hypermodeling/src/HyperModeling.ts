/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { IModelApp, Plugin, Tool, ScreenViewport } from "@bentley/imodeljs-frontend";
import { I18NNamespace } from "@bentley/imodeljs-i18n";
import { SectionLocationSetDecoration } from "./HyperModelingMarkers";

/** Parses a string case-insensitively returning true for "ON", false for "OFF", undefined for "TOGGLE" or undefined, and the input string for anything else. */
function parseToggle(arg: string | undefined): string | boolean | undefined {
  if (undefined === arg)
    return undefined;

  switch (arg.toLowerCase()) {
    case "on": return true;
    case "off": return false;
    case "toggle": return undefined;
    default: return arg;
  }
}

/** Base class to enable or disable section marker display by category or type.
 * The key-in takes at most 1 argument (case-insensitive):
 *  - "ON" => enable display of markers
 *  - "OFF" => disable display of markers
 *  - "TOGGLE" or omitted => toggle display of markers
 * Must explicitly "sync" to update currently displayed markers after a setting change.
 * @beta
 */
export abstract class SectionMarkerFilterTool extends Tool {
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }

  public run(_enable?: boolean): boolean { return false; }

  public parseAndRun(...args: string[]): boolean {
    const enable = parseToggle(args[0]);
    if (typeof enable !== "string")
      return this.run(enable);
    return false;
  }
}

/** Enable or disable section marker display by category.
 * @beta
 */
export class SectionMarkerCategoryTool extends SectionMarkerFilterTool {
  public static toolId = "SectionMarkerCategory";
  public run(enable?: boolean): boolean {
    SectionLocationSetDecoration.props.display.category = (undefined === enable ? !SectionLocationSetDecoration.props.display.category : enable);
    return true;
  }
}

/** Enable or disable section type marker display.
 * @beta
 */
export class SectionMarkerSectionTool extends SectionMarkerFilterTool {
  public static toolId = "SectionMarkerSection";
  public run(enable?: boolean): boolean {
    SectionLocationSetDecoration.props.display.section = (undefined === enable ? !SectionLocationSetDecoration.props.display.section : enable);
    return true;
  }
}

/** Enable or disable detail type marker display.
 * @beta
 */
export class SectionMarkerDetailTool extends SectionMarkerFilterTool {
  public static toolId = "SectionMarkerDetail";
  public run(enable?: boolean): boolean {
    SectionLocationSetDecoration.props.display.detail = (undefined === enable ? !SectionLocationSetDecoration.props.display.detail : enable);
    return true;
  }
}

/** Enable or disable elevation type marker display.
 * @beta
 */
export class SectionMarkerElevationTool extends SectionMarkerFilterTool {
  public static toolId = "SectionMarkerElevation";
  public run(enable?: boolean): boolean {
    SectionLocationSetDecoration.props.display.elevation = (undefined === enable ? !SectionLocationSetDecoration.props.display.elevation : enable);
    return true;
  }
}

/** Enable or disable plan type marker display.
 * @beta
 */
export class SectionMarkerPlanTool extends SectionMarkerFilterTool {
  public static toolId = "SectionMarkerPlan";
  public run(enable?: boolean): boolean {
    SectionLocationSetDecoration.props.display.plan = (undefined === enable ? !SectionLocationSetDecoration.props.display.plan : enable);
    return true;
  }
}

/** Enable or disable section location markers.
 * The key-in takes at most 1 argument (case-insensitive):
 *  - "ON" => enable display of markers
 *  - "OFF" => disable display of markers
 *  - "SYNC" => update visibility of current markers, ex. category selector or section type filter changes.
 *  - "UPDATE" => recreate markers with new query if currently enabled, ex. model selector changes
 *  - "TOGGLE" or omitted => toggle display of markers
 * @beta
 */
export class SectionMarkerDisplayTool extends Tool {
  public static toolId = "SectionMarkerDisplay";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }

  public run(vp?: ScreenViewport, enable?: boolean, sync?: boolean, update?: boolean): boolean {
    if (undefined === enable)
      enable = (undefined === SectionLocationSetDecoration.decorator);
    if (undefined === sync)
      sync = false;
    if (undefined === update)
      update = false;
    if (enable || sync || update) {
      if (undefined === vp)
        vp = IModelApp.viewManager.selectedView;
      if (undefined === vp)
        return false;
      SectionLocationSetDecoration.show(vp, sync, update); // tslint:disable-line:no-floating-promises
    } else {
      SectionLocationSetDecoration.clear();
    }
    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    let enable, sync, update;
    const argVal = parseToggle(args[0]);
    if (typeof argVal !== "string") {
      enable = (undefined === argVal ? (undefined === SectionLocationSetDecoration.decorator) : argVal);
    } else {
      switch (argVal.toLowerCase()) {
        case "sync": sync = true; break;
        case "update": update = true; break;
      }
    }
    return this.run(undefined, enable, sync, update);
  }
}

/** The plugin class that is instantiated when the plugin is loaded, and executes the operations
 * @beta
 */
export class HyperModelingPlugin extends Plugin {
  private _i18NNamespace?: I18NNamespace;
  public static plugin: HyperModelingPlugin | undefined;

  /** Invoked the first time this plugin is loaded. */
  public onLoad(_args: string[]): void {
    HyperModelingPlugin.plugin = this; // store the plugin.
    this._i18NNamespace = this.i18n.registerNamespace("HyperModeling");
    this._i18NNamespace!.readFinished.then(() => {
      IModelApp.tools.register(SectionMarkerDisplayTool, this._i18NNamespace, this.i18n);
      IModelApp.tools.register(SectionMarkerCategoryTool, this._i18NNamespace, this.i18n);
      IModelApp.tools.register(SectionMarkerSectionTool, this._i18NNamespace, this.i18n);
      IModelApp.tools.register(SectionMarkerDetailTool, this._i18NNamespace, this.i18n);
      IModelApp.tools.register(SectionMarkerElevationTool, this._i18NNamespace, this.i18n);
      IModelApp.tools.register(SectionMarkerPlanTool, this._i18NNamespace, this.i18n);
    }).catch(() => { });
  }

  /** Invoked each time this plugin is loaded. */
  public onExecute(args: string[]): void {
    if (args.length < 2)
      return; // if no "optional" args passed in, don't do anything. NOTE: args[0] is plugin name...

    const enable = parseToggle(args[1]);
    if (typeof enable !== "boolean")
      return; // Allow simple enable/disable request only...

    if (enable && undefined !== IModelApp.viewManager.selectedView)
      SectionLocationSetDecoration.show(IModelApp.viewManager.selectedView, false, false); // tslint:disable-line:no-floating-promises
    else
      SectionLocationSetDecoration.clear();
  }
}

// This variable is set by webPack when building a plugin.
declare var PLUGIN_NAME: string;

// Register the plugin with the pluginAdmin.
IModelApp.pluginAdmin.register(new HyperModelingPlugin(PLUGIN_NAME));
