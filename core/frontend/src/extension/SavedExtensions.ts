/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Extensions
 */

import { Logger } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext, SettingsResult, SettingsStatus, Config } from "@bentley/imodeljs-clients";

import { IModelApp } from "../IModelApp";
import { NotifyMessageDetails, OutputMessageAlert, OutputMessagePriority, OutputMessageType } from "../NotificationManager";
import { ExtensionLoadResults, detailsFromExtensionLoadResults } from "./ExtensionResults";
import { Extension } from "./Extension";

const loggerCategory = "imodeljs-frontend.Extension";

class SavedExtension {
  constructor(public name: string, public args?: string[]) { }
}

/**
 * @alpha
 */
export class SavedExtensionClient {

  private static async getExtensionsList(requestContext: AuthorizedClientRequestContext, settingName: string, allUsers: boolean): Promise<SavedExtension[] | undefined> {
    let settingsResult: SettingsResult;
    if (allUsers)
      settingsResult = await IModelApp.settings.getSetting(requestContext, "SavedExtensions", settingName, true);
    else
      settingsResult = await IModelApp.settings.getUserSetting(requestContext, "SavedExtensions", settingName, true);

    if (SettingsStatus.Success !== settingsResult.status)
      return undefined;

    return settingsResult.setting.extensions as SavedExtension[];
  }

  // TODO:  Not sure I like this...
  private static getConfigExtensionList(configVarName: string): SavedExtension[] | undefined {
    if (!Config.App.has("SavedExtensions"))
      return undefined;

    // should be a list of extensions with arguments separated by | symbol, separated by semicolons. i.e. "Safetibase|arg1|arg2;IoTInterface|arg1|arg2"
    const configNameSpace = Config.App.get("SavedExtensions");
    let configValue: string | undefined;
    if (undefined === (configValue = configNameSpace[configVarName]))
      return undefined;
    const savedExtensions: SavedExtension[] = [];
    const extensionArray: string[] = configValue.split(";");
    for (const extensionSpec of extensionArray) {
      const args: string[] = extensionSpec.split("|");
      if (args.length < 1)
        continue;
      if (args.length === 1)
        savedExtensions.push(new SavedExtension(args[0]));
      else
        savedExtensions.push(new SavedExtension(args[0], args.slice(1)));
    }
    return (savedExtensions.length > 0) ? savedExtensions : undefined;
  }

  /** Loads a list of extensions stored in user settings, application settings, and/or a configuration variable.
   * Returns the status of loading the extensions.
   * @param requestContext The client request context
   * @param settingName The name of the setting (or the name of the configuration variable when requesting extensions from a configuration variable).
   * @param userSettings If true, looks up the settingName application-specific user setting, in settings namespace "SavedExtensions", to find the list of extensions to load. Defaults to true.
   * @param appSettings If true, looks up the application-specific (i.e., all users) setting, in settings namespace "SavedExtensions", to find the list of extensions to load. Defaults to true.
   * @param configuration If true, retrieves the configuration variable "SavedExtensions.<settingName>" to get the list of extensions to load. Defaults to true.
   * @internal
   */
  public static async loadSavedExtensions(requestContext: AuthorizedClientRequestContext, settingName: string, userSettings?: boolean, appSettings?: boolean, configuration?: boolean): Promise<LoadSavedExtensionsResult> {
    // retrieve the setting specified
    let appList: SavedExtension[] | undefined;
    let userList: SavedExtension[] | undefined;
    let configList: SavedExtension[] | undefined;

    // the setting should be an array of extensions to load. Each array member is an object with shape {name: string, args: string[]|undefined},
    if ((undefined === appSettings) || appSettings)
      appList = await this.getExtensionsList(requestContext, settingName, true);
    if ((undefined === userSettings) || userSettings)
      userList = await this.getExtensionsList(requestContext, settingName, false);
    if ((undefined === configuration) || configuration)
      configList = this.getConfigExtensionList(settingName);

    if (!appList && !userList && !configList)
      return new LoadSavedExtensionsResult(LoadSavedExtensionsStatus.NoSavedExtensions);

    let masterList: SavedExtension[] = [];
    if (appList)
      masterList = masterList.concat(appList);
    if (userList)
      masterList = masterList.concat(userList);
    if (configList)
      masterList = masterList.concat(configList);

    // go through the settings and try to load the extensions:
    const extensionPromises: Array<Promise<ExtensionLoadResults>> = [];
    const extensionNames: string[] = [];
    for (const extensionObj of masterList) {
      let extensionName: string;
      let extensionArgs: string[] | undefined;
      if (undefined !== extensionObj.name) {
        extensionName = extensionObj.name;
        extensionArgs = extensionObj.args;
        extensionNames.push(extensionName);
        extensionPromises.push(IModelApp.extensionAdmin.loadExtension(extensionName, undefined, extensionArgs));
      } else {
        extensionPromises.push(Promise.resolve(`No extension name specified in ${extensionObj.toString()}`));
      }
    }

    try {
      await Promise.all(extensionPromises);
      const allExtensionResults: Map<string, ExtensionLoadResults> = new Map<string, ExtensionLoadResults>();

      let atLeastOneFail: boolean = false;
      let atLeastOnePass: boolean = false;
      let iExtension: number = 0;
      for (const thisPromise of extensionPromises) {
        const promiseValue = await thisPromise;
        allExtensionResults.set(extensionNames[iExtension], promiseValue);
        ++iExtension;
        if (!(promiseValue instanceof Extension)) {
          atLeastOneFail = true;
        } else {
          atLeastOnePass = true;
        }
      }
      if (atLeastOneFail && !atLeastOnePass) {
        return new LoadSavedExtensionsResult(LoadSavedExtensionsStatus.AllExtensionsFailedToLoad, "iModelJs:ExtensionErrors.AllSavedExtensionsFailed", allExtensionResults);
      } else if (atLeastOneFail) {
        return new LoadSavedExtensionsResult(LoadSavedExtensionsStatus.SomeExtensionsFailedToLoad, "iModelJs:ExtensionErrors.SomeSavedExtensionsFailed", allExtensionResults);
      } else {
        return new LoadSavedExtensionsResult(LoadSavedExtensionsStatus.Success, "iModelJs:ExtensionErrors.SavedExtensionsSuccess", allExtensionResults);
      }
    } catch (err) {
      return new LoadSavedExtensionsResult(LoadSavedExtensionsStatus.LoadError, err.toString);
    }
  }

  /** Adds an extension to settings to be opened by loadSavedExtensions.
   * @beta
   */
  public async addSavedExtensions(requestContext: AuthorizedClientRequestContext, extensionName: string, args: string[] | undefined, allUsers: boolean, settingName: string) {
    // retrieve the setting specified so we can append to it.
    let settingsResult: SettingsResult;
    let settings: SavedExtension[];
    if (allUsers) {
      settingsResult = await IModelApp.settings.getSetting(requestContext, "SavedExtensions", settingName, true, undefined, undefined);
    } else {
      settingsResult = await IModelApp.settings.getUserSetting(requestContext, "SavedExtension", settingName, true, undefined, undefined);
    }

    if (settingsResult.status !== SettingsStatus.Success) {
      // create new setting.
      settings = [];
    } else {
      settings = settingsResult.setting.extensions;
    }
    settings.push(new SavedExtension(extensionName, args));
    if (allUsers) {
      IModelApp.settings.saveSetting(requestContext, settings, "SavedExtensions", settingName, true, undefined, undefined).catch((_err) => { });
    } else {
      IModelApp.settings.saveUserSetting(requestContext, settings, "SavedExtensions", settingName, true, undefined, undefined).catch((_err) => { });
    }
  }

  /** Removes a saved extension from the settings to be opened by loadSavedExtensions.
   * @beta
   */
  public static async removeSavedExtensions(requestContext: AuthorizedClientRequestContext, extensionName: string, allUsers: boolean, settingName: string) {
    // retrieve the setting specified so we can either remove from it or delete it entirely.
    let settingsResult: SettingsResult;
    if (allUsers) {
      settingsResult = await IModelApp.settings.getSetting(requestContext, "SavedExtensions", settingName, true, undefined, undefined).catch((_err) => new SettingsResult(SettingsStatus.ServerError));
    } else {
      settingsResult = await IModelApp.settings.getUserSetting(requestContext, "SavedExtensions", settingName, true, undefined, undefined).catch((_err) => new SettingsResult(SettingsStatus.ServerError));
    }

    // if the setting doesn't already exists, we can't remove anything from it.
    if (settingsResult.status !== SettingsStatus.Success)
      return;

    const settings: SavedExtension[] = settingsResult.setting.extensions;

    // collect all the remaining extensions.
    const newSettings: SavedExtension[] = [];
    for (const savedExtension of settings) {
      if (savedExtension.name !== extensionName) {
        newSettings.push(savedExtension);
      }
    }

    if (newSettings.length > 0) {
      if (allUsers) {
        IModelApp.settings.saveSetting(requestContext, newSettings, "SavedExtensions", settingName, true).catch((_err) => { });
      } else {
        IModelApp.settings.saveUserSetting(requestContext, newSettings, "SavedExtensions", settingName, true).catch((_err) => { });
      }
    } else {
      if (allUsers) {
        IModelApp.settings.deleteSetting(requestContext, "SavedExtensions", settingName, true).catch((_err) => { });
      } else {
        IModelApp.settings.deleteUserSetting(requestContext, "SavedExtensions", settingName, true).catch((_err) => { });
      }
    }
  }
}

/** @internal */
export enum LoadSavedExtensionsStatus {
  Success = 0,
  NotLoggedIn = 1,
  NoSavedExtensions = 2,
  SettingsInvalid = 3,
  SomeExtensionsFailedToLoad = 4,
  AllExtensionsFailedToLoad = 5,
  LoadError = 6,
}

/** @internal */
export class LoadSavedExtensionsResult {
  constructor(public status: LoadSavedExtensionsStatus, public i18nkey?: string, public extensionResults?: Map<string, ExtensionLoadResults>) { }

  // report the results of the load to the notification manager.
  public report(): void {
    // if there's no i18nkey, no need to report (that's what we get when the setting doesn't exist).
    if (undefined === this.i18nkey)
      return;

    const message: string = IModelApp.i18n.translate(this.i18nkey);
    Logger.logError(loggerCategory, message);

    const successDiv: HTMLElement = document.createElement("div");
    const errorDiv: HTMLElement = document.createElement("div");
    if (undefined !== this.extensionResults) {
      for (const result of this.extensionResults) {
        const returnVal = detailsFromExtensionLoadResults(result[0], result[1], true);
        if (result[1] instanceof Extension) {
          if (returnVal.detailHTML)
            successDiv.appendChild(returnVal.detailHTML);
        } else {
          if (undefined !== returnVal.detailHTML) {
            const pDiv = document.createElement("div");
            pDiv.innerHTML = IModelApp.i18n.translate("iModelJs:ExtensionErrors.UnableToLoad", { extensionName: result[0] }) + " :";
            const innerDiv = document.createElement("div");
            innerDiv.style.paddingLeft = "15px";
            innerDiv.appendChild(returnVal.detailHTML);
            pDiv.appendChild(innerDiv);
            errorDiv.appendChild(pDiv);

            if (undefined !== returnVal.detailStrings)
              Logger.logError(loggerCategory, result[0] + " failed to load. Error=" + returnVal.detailStrings);
          }
        }
      }
      const topDiv: HTMLElement = document.createElement("div");
      topDiv.appendChild(successDiv);
      topDiv.appendChild(errorDiv);

      let errorDetails: NotifyMessageDetails;
      if (LoadSavedExtensionsStatus.Success !== this.status)
        errorDetails = new NotifyMessageDetails(OutputMessagePriority.Warning, message, topDiv, OutputMessageType.Alert, OutputMessageAlert.Balloon);
      else
        errorDetails = new NotifyMessageDetails(OutputMessagePriority.Info, message, topDiv, OutputMessageType.InputField, OutputMessageAlert.None);

      IModelApp.notifications.outputMessage(errorDetails);
    }
  }
}
