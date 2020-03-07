/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp, Extension, Tool, ScreenViewport } from "@bentley/imodeljs-frontend";
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
export class SectionMarkerFilterCategoryTool extends SectionMarkerFilterTool {
  public static toolId = "HyperModeling.Marker.Category";
  public run(enable?: boolean): boolean {
    SectionLocationSetDecoration.props.display.category = (undefined === enable ? !SectionLocationSetDecoration.props.display.category : enable);
    return true;
  }
}

/** Enable or disable section type marker display.
 * @beta
 */
export class SectionMarkerFilterSectionTypeTool extends SectionMarkerFilterTool {
  public static toolId = "HyperModeling.Marker.Type.Section";
  public run(enable?: boolean): boolean {
    SectionLocationSetDecoration.props.display.section = (undefined === enable ? !SectionLocationSetDecoration.props.display.section : enable);
    return true;
  }
}

/** Enable or disable detail type marker display.
 * @beta
 */
export class SectionMarkerFilterDetailTypeTool extends SectionMarkerFilterTool {
  public static toolId = "HyperModeling.Marker.Type.Detail";
  public run(enable?: boolean): boolean {
    SectionLocationSetDecoration.props.display.detail = (undefined === enable ? !SectionLocationSetDecoration.props.display.detail : enable);
    return true;
  }
}

/** Enable or disable elevation type marker display.
 * @beta
 */
export class SectionMarkerFilterElevationTypeTool extends SectionMarkerFilterTool {
  public static toolId = "HyperModeling.Marker.Type.Elevation";
  public run(enable?: boolean): boolean {
    SectionLocationSetDecoration.props.display.elevation = (undefined === enable ? !SectionLocationSetDecoration.props.display.elevation : enable);
    return true;
  }
}

/** Enable or disable plan type marker display.
 * @beta
 */
export class SectionMarkerFilterPlanTypeTool extends SectionMarkerFilterTool {
  public static toolId = "HyperModeling.Marker.Type.Plan";
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
  public static toolId = "HyperModeling.Marker.Display";
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

/** The extension class that is instantiated when the extension is loaded, and executes the operations
 * @beta
 */
export class HyperModelingExtension extends Extension {
  private _i18NNamespace?: I18NNamespace;
  public static extension: HyperModelingExtension | undefined;

  /** Invoked the first time this extension is loaded. */
  public onLoad(_args: string[]): void {
    HyperModelingExtension.extension = this; // store the extension.
    this._i18NNamespace = this.i18n.registerNamespace("HyperModeling");
    this._i18NNamespace!.readFinished.then(() => {
      IModelApp.tools.register(SectionMarkerDisplayTool, this._i18NNamespace, this.i18n);
      IModelApp.tools.register(SectionMarkerFilterCategoryTool, this._i18NNamespace, this.i18n);
      IModelApp.tools.register(SectionMarkerFilterSectionTypeTool, this._i18NNamespace, this.i18n);
      IModelApp.tools.register(SectionMarkerFilterDetailTypeTool, this._i18NNamespace, this.i18n);
      IModelApp.tools.register(SectionMarkerFilterElevationTypeTool, this._i18NNamespace, this.i18n);
      IModelApp.tools.register(SectionMarkerFilterPlanTypeTool, this._i18NNamespace, this.i18n);
    }).catch(() => { });
  }

  /** Invoked each time this extension is loaded. */
  public onExecute(args: string[]): void {
    if (args.length < 2)
      return; // if no "optional" args passed in, don't do anything. NOTE: args[0] is extension name...

    const enable = parseToggle(args[1]);
    if (typeof enable !== "boolean")
      return; // Allow simple enable/disable request only...

    if (enable && undefined !== IModelApp.viewManager.selectedView)
      SectionLocationSetDecoration.show(IModelApp.viewManager.selectedView, false, false); // tslint:disable-line:no-floating-promises
    else
      SectionLocationSetDecoration.clear();
  }
}

// This variable is set by webPack when building a extension.
declare var PLUGIN_NAME: string;

// Register the extension with the extensionAdmin.
IModelApp.extensionAdmin.register(new HyperModelingExtension(PLUGIN_NAME));
