/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tools */

import { Tool } from "./Tool";
import { PluginAdmin } from "../Plugin";
import { IModelApp } from "../IModelApp";

/**
 * An Immediate Tool that allows an iModelJs plugin module to be loaded .
 */
export class PluginTool extends Tool {
  public static toolId = "Plugin";
  public run(args: any[]): boolean {
    // we can only use $script in a browser environment.
    if (!typeof document) {
      // tslint:disable:no-console
      console.log("PluginTool is only available in browser environment");
      return false;
    }

    // tslint:disable:no-console
    if (args && args.length > 0 && args[0]) {
      // tslint:disable-line:no-console
      PluginAdmin.loadPlugin(args[0], args.slice(1))
        .then(() => { })
        .catch((_err) => { console.log(IModelApp.i18n.translate("IModelJs:PluginErrors.UnableToLoad", { pluginName: args[0] })); });
    }
    return true;
  }
}
