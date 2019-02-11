/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tools */

import { Tool } from "./Tool";
import { PluginAdmin } from "../Plugin";
import { IModelApp } from "../IModelApp";

/** An Immediate Tool that starts the process of loading an iModelJs plugin. */
export class PluginTool extends Tool {
  public static toolId = "Plugin";
  public run(args: any[]): boolean {
    if (args && args.length > 0 && args[0]) {
      PluginAdmin.loadPlugin(args[0], args.slice(1))
        .then(() => { })
        .catch((_err) => { IModelApp.notifications.outputMessage(IModelApp.i18n.translate("PluginErrors.UnableToLoad", { pluginName: args[0] })); });
    }
    return true;
  }
}
