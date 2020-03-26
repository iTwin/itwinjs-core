/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tools
 */

import { Logger } from "@bentley/bentleyjs-core";
import { Tool } from "./Tool";
import { Extension } from "../extension/Extension";
import { NotifyMessageDetails, OutputMessageAlert, OutputMessagePriority, OutputMessageType } from "../NotificationManager";
import { IModelApp } from "../IModelApp";
import { ExtensionLoadResults, detailsFromExtensionLoadResults } from "../extension/ExtensionResults";

const loggerCategory = "imodeljs-frontend.Extension";

/** An Immediate Tool that starts the process of loading an iModel.js extension. */
export class ExtensionTool extends Tool {
  public static toolId = "Extension";
  public static get maxArgs() { return undefined; }
  public static get minArgs() { return 1; }
  public parseAndRun(...args: string[]): boolean {
    return this.run(args);
  }

  public run(args: any[]): boolean {
    if (args && args.length > 0 && args[0]) {
      IModelApp.extensionAdmin.loadExtension(args[0], undefined, args.slice(1))
        .then(ExtensionTool.showLoadProblems.bind(null, args[0]))
        .catch((_err: any) => {
          // this should happen only on completely unexpected errors.
          IModelApp.notifications.outputMessage(IModelApp.i18n.translate("iModelJs:ExtensionErrors.UnableToLoad", { extensionName: args[0] }));
        });
    }
    return true;
  }

  // displays the problems encountered while trying to load a extension
  private static showLoadProblems(extensionName: string, extensionResults: ExtensionLoadResults) {
    if (!extensionResults || (("string" !== typeof (extensionResults)) && !Array.isArray(extensionResults))) {
      if (extensionResults instanceof Extension) {
        const briefMessage = IModelApp.i18n.translate("iModelJs:ExtensionErrors.Success", { extensionName });
        const info = new NotifyMessageDetails(OutputMessagePriority.Info, briefMessage, undefined, OutputMessageType.InputField);
        IModelApp.notifications.outputMessage(info);
        Logger.logInfo(loggerCategory, briefMessage);
      }
    } else {
      const returnVal = detailsFromExtensionLoadResults(extensionName, extensionResults, false);
      const briefMessage = IModelApp.i18n.translate("iModelJs:ExtensionErrors.CantLoad", { extensionName });
      const errorDetails = new NotifyMessageDetails(OutputMessagePriority.Warning, briefMessage, returnVal.detailHTML, OutputMessageType.Alert, OutputMessageAlert.Balloon);
      IModelApp.notifications.outputMessage(errorDetails);
      Logger.logError(loggerCategory, extensionName + " failed to load. Error=" + returnVal.detailStrings);
    }
  }
}
