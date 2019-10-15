/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { IModelApp, Plugin, Tool, ScreenViewport } from "@bentley/imodeljs-frontend";
import { I18NNamespace } from "@bentley/imodeljs-i18n";
import { SectionLocationSetDecoration } from "./HyperModelingMarkers";

/** Enable or disable section location markers.
 * The key-in takes at most 1 argument (case-insensitive):
 *  - "ON" => enable display of markers
 *  - "OFF" => disable display of markers
 *  - "SYNC" => update visibility of markers if currently displayed, ex. category selector changes
 *  - "UPDATE" => recreate markers if currently displayed, ex. model selector changes
 *  - "TOGGLE" or omitted => toggle display of markers
 * @beta
 */
export class SectionLocationMarkersTool extends Tool {
  public static toolId = "SectionLocationMarkers";
  public static plugin: HyperModelingPlugin | undefined;
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }

  public run(vp?: ScreenViewport, enable?: boolean, sync?: boolean, update?: boolean): boolean {
    if (undefined === SectionLocationMarkersTool.plugin)
      return false;
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
      SectionLocationSetDecoration.show(SectionLocationMarkersTool.plugin, vp, sync, update); // tslint:disable-line:no-floating-promises
    } else {
      SectionLocationSetDecoration.clear();
    }
    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    let enable, sync, update;
    if (undefined !== args[0]) {
      switch (args[0].toLowerCase()) {
        case "sync":
          sync = true;
          break;
        case "update":
          update = true;
          break;
        case "on":
          enable = true;
          break;
        case "off":
          enable = false;
          break;
        case "toggle":
          enable = (undefined === SectionLocationSetDecoration.decorator);
          break;
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

  /** Invoked the first time this plugin is loaded. */
  public onLoad(_args: string[]): void {
    SectionLocationMarkersTool.plugin = this; // store the plugin in the tool prototype.
    this._i18NNamespace = this.i18n.registerNamespace("HyperModeling");
    this._i18NNamespace!.readFinished.then(() => {
      IModelApp.tools.register(SectionLocationMarkersTool, this._i18NNamespace, this.i18n);
      SectionLocationMarkersTool.plugin = this;
    }).catch(() => { });
  }

  /** Invoked each time this plugin is loaded. */
  public onExecute(_args: string[]): void { }
}

// This variable is set by webPack when building a plugin.
declare var PLUGIN_NAME: string;

// Register the plugin with the pluginAdmin.
IModelApp.pluginAdmin.register(new HyperModelingPlugin(PLUGIN_NAME));
