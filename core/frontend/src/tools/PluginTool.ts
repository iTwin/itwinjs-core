/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tools */

import { Tool } from "./Tool";
import { PluginAdmin, PluginLoadResults, Plugin } from "../plugin/Plugin";
import { NotifyMessageDetails, OutputMessageAlert, OutputMessagePriority, OutputMessageType } from "../NotificationManager";
import { Logger } from "@bentley/bentleyjs-core";
import { IModelApp } from "../IModelApp";

const loggerCategory = "imodeljs-frontend.Plugin";

/** An Immediate Tool that starts the process of loading an iModelJs plugin. */
export class PluginTool extends Tool {
  public static toolId = "Plugin";
  public static get maxArgs() { return undefined; }
  public static get minArgs() { return 1; }
  public parseAndRun(...args: string[]): boolean {
    return this.run(args);
  }

  public run(args: any[]): boolean {
    if (args && args.length > 0 && args[0]) {
      IModelApp.pluginAdmin.loadPlugin(args[0], args.slice(1))
        .then(PluginTool.showLoadProblems.bind(null, args[0]))
        .catch((_err: any) => {
          // this should happen only on completely unexpected errors.
          IModelApp.notifications.outputMessage(IModelApp.i18n.translate("iModelJs:PluginErrors.UnableToLoad", { pluginName: args[0] }));
        });
    }
    return true;
  }

  // displays the problems encountered while trying to load a plugin
  private static showLoadProblems(pluginName: string, pluginResults: PluginLoadResults) {
    if (!pluginResults || (("string" !== typeof (pluginResults)) && !Array.isArray(pluginResults))) {
      if (pluginResults instanceof Plugin) {
        const briefMessage = IModelApp.i18n.translate("iModelJs:PluginErrors.Success", { pluginName });
        const info = new NotifyMessageDetails(OutputMessagePriority.Info, briefMessage, undefined, OutputMessageType.InputField);
        IModelApp.notifications.outputMessage(info);
        Logger.logInfo(loggerCategory, briefMessage);
      }
    } else {
      const returnVal = PluginAdmin.detailsFromPluginLoadResults(pluginName, pluginResults, false);
      const briefMessage = IModelApp.i18n.translate("iModelJs:PluginErrors.CantLoad", { pluginName });
      const errorDetails = new NotifyMessageDetails(OutputMessagePriority.Warning, briefMessage, returnVal.detailHTML, OutputMessageType.Alert, OutputMessageAlert.Balloon);
      IModelApp.notifications.outputMessage(errorDetails);
      Logger.logError(loggerCategory, pluginName + " failed to load. Error=" + returnVal.detailStrings);
    }
  }
}
