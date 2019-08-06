/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tools */

import { Tool } from "./Tool";
import { PluginAdmin, PluginLoadResults } from "../plugin/Plugin";
import { NotifyMessageDetails, OutputMessageAlert, OutputMessagePriority, OutputMessageType } from "../NotificationManager";
import { Logger } from "@bentley/bentleyjs-core";
import { IModelApp } from "../IModelApp";

const loggerCategory = "imodeljs-frontend.Plugin";

/** An Immediate Tool that starts the process of loading an iModelJs plugin. */
export class PluginTool extends Tool {
  public static toolId = "Plugin";
  public run(args: any[]): boolean {
    if (args && args.length > 0 && args[0]) {
      PluginAdmin.loadPlugin(args[0], args.slice(1))
        .then(PluginTool.showLoadProblems.bind(null, args[0]))
        .catch((_err: any) => {
          // this should happen only on completely unexpected errors.
          IModelApp.notifications.outputMessage(IModelApp.i18n.translate("PluginErrors.UnableToLoad", { pluginName: args[0] }));
        });
    }
    return true;
  }

  // displays the problems encountered while trying to load a plugin
  private static showLoadProblems(pluginName: string, pluginResults: PluginLoadResults) {
    let problems: undefined | string[];
    if (pluginResults && "string" === typeof (pluginResults))
      problems = [pluginResults];
    else if (Array.isArray(pluginResults))
      problems = pluginResults;

    if (problems) {
      // report load errors to the user.
      let allDetails: string = "";
      for (const thisMessage of problems) {
        allDetails = allDetails.concat("<br>", thisMessage);
      }
      const allDetailsFragment: any = document.createRange().createContextualFragment(allDetails);
      const allDetailsHtml: HTMLElement = document.createElement("span");
      allDetailsHtml.appendChild(allDetailsFragment);
      const briefMessage = IModelApp.i18n.translate("iModelJs:PluginErrors.CantLoad", { pluginName });
      const errorDetails = new NotifyMessageDetails(OutputMessagePriority.Warning, briefMessage, allDetailsHtml, OutputMessageType.Alert, OutputMessageAlert.Balloon);
      IModelApp.notifications.outputMessage(errorDetails);

      Logger.logError(loggerCategory, pluginName + " failed to load. Error=" + allDetails);
    }
  }
}
