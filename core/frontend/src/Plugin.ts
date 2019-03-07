/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Plugins */
import * as semver from "semver";
import { IModelApp } from "./IModelApp";
import { NotifyMessageDetails, OutputMessageAlert, OutputMessagePriority, OutputMessageType } from "./NotificationManager";
import { Logger } from "@bentley/bentleyjs-core";

const loggerCategory = "imodeljs-frontend.Plugin";

type resolveFunc = ((arg: any) => void);
type rejectFunc = ((arg: Error) => void);

/**
 * Base Plugin class for writing a demand-loaded module.
 * @see [[PluginAdmin]] for a description of how Plugins are loaded.
 * @see [Plugins]($docs/learning/frontend/plugins.md)
 */
export abstract class Plugin {
  /**
   * Constructor for base Plugin class
   * @param name - the name of the plugin. When you use the buildIModelJsModule build script, this argument is filled in as the PLUGIN_NAME constant by webpack
   * @param versionsRequired - the versions of iModel.js system modules that this Plugin requires. When you use the buildIModelJsModule build script, this argument
   * is filled in as the IMODELJS_VERSIONS_REQUIRED constant by webpack.
   * @note Typically, a Plugin subclass is instantiated and registered with top-level JavaScript statements like these:
   * ```ts
   *  const myPlugin = new MyPlugin(PLUGIN_NAME, IMODELJS_VERSIONS_REQUIRED);
   *  PluginAdmin.register(myPlugin);
   * ```
   */
  public constructor(public name: string, public versionsRequired: string) {
  }

  /**
   * Method called when the Plugin is first loaded.
   * @param _args arguments that were passed to PluginAdmin.loadPlugin. The first argument is the plugin name.
   */
  public onLoad(_args: string[]): void {
  }

  /**
   * Method called immediately following the call to onLoad when the Plugin is first loaded, and also once for
   * each additional call to PluginAdmin.loadPlugin for the same Plugin.
   * @param _args arguments that were passed to PluginAdmin.loadPlugin. The first argument is the plugin name.
   */
  public abstract onExecute(_args: string[]): void;
}

// this private class represents a Plugin that we are attempting to load.
class PendingPlugin {
  public resolve: resolveFunc | undefined = undefined;
  public reject: rejectFunc | undefined = undefined;
  public promise: Promise<Plugin>;

  public constructor(private _packageName: string, public args?: string[]) {
    this.promise = new Promise(this.executor.bind(this));
  }

  public executor(resolve: resolveFunc, reject: rejectFunc) {
    this.resolve = resolve;
    this.reject = reject;

    const head = document.getElementsByTagName("head")[0];
    if (!head)
      reject(new Error("no head element found"));

    // create the script element. handle onload and onerror.
    const scriptElement = document.createElement("script");

    scriptElement.onerror = (ev) => {
      scriptElement.onload = null;
      reject(new Error("can't load " + this._packageName + " : " + ev));
    };

    scriptElement.async = true;
    scriptElement.src = this._packageName;
    head.insertBefore(scriptElement, head.lastChild);
  }
}

/**
 * Controls loading of Plugins and calls methods on newly loaded or reloaded Plugins
 */
export class PluginAdmin {
  private static _pendingPlugins: Map<string, PendingPlugin> = new Map<string, PendingPlugin>();
  private static _registeredPlugins: Map<string, Plugin> = new Map<string, Plugin>();

  /**
   * Retrieves a previously loaded Plugin.
   * @param pluginName
   */
  public static getPlugin(pluginName: string): Promise<Plugin> | undefined {
    // strip off .js if necessary
    pluginName = PluginAdmin.getPluginName(pluginName);
    const plugin = PluginAdmin._registeredPlugins.get(pluginName);
    if (plugin)
      return Promise.resolve(plugin);
    const pluginPromise = PluginAdmin._pendingPlugins.get(pluginName);
    if (pluginPromise) {
      return pluginPromise.promise;
    }
    return undefined;
  }

  // returns an array of strings with version mismatch errors, or undefined if the versions of all modules are usable.
  private static checkIModelJsVersions(versionsRequired: string): string[] | undefined {
    // make sure we're in a browser-like environment
    if ((typeof window === "undefined") || !window) {
      return [IModelApp.i18n.translate("iModelJs:PluginErrors.FrontEndOnly")];
    }
    const versionsLoaded: Map<string, string> = (window as any).iModelJsVersions;
    if (!versionsLoaded) {
      return [IModelApp.i18n.translate("iModelJs:PluginErrors.NoVersionsLoaded")];
    }

    // make sure the versionsRequired string isn't empty.
    if (!versionsRequired || (0 === versionsRequired.length)) {
      return [IModelApp.i18n.translate("iModelJs:PluginErrors.WebpackedIncorrectly")];
    }

    // make sure versionsRequired is a JSON string.
    const errorMessages: string[] = [];
    try {
      const versionsRequiredObject: any = JSON.parse(versionsRequired);
      for (const moduleName of Object.getOwnPropertyNames(versionsRequiredObject)) {
        // bwc doesn't set its version, so we have to ignore it for now.
        if (moduleName === "bwc") {
          continue;
        }
        const versionRequired: string = versionsRequiredObject[moduleName];
        if (!versionRequired || "string" !== typeof (versionRequired)) {
          errorMessages.push(IModelApp.i18n.translate("iModelJs:PluginErrors.NoVersionSpecified", { moduleName }));
        } else {
          const versionLoaded = versionsLoaded.get(moduleName);
          if (!versionLoaded) {
            errorMessages.push(IModelApp.i18n.translate("iModelJs:PluginErrors.ModuleNotLoaded", { moduleName }));
          } else {
            // check version required vs. version loaded.
            if (!semver.satisfies(versionLoaded, versionRequired)) {
              errorMessages.push(IModelApp.i18n.translate("iModelJs:PluginErrors.VersionMismatch", { versionLoaded, moduleName, versionRequired }));
            }
          }
        }
      }
    } catch (err) {
      return [IModelApp.i18n.translate("iModelJs:PluginErrors.WebpackedIncorrectly")];
    }
    return (errorMessages.length > 0) ? errorMessages : undefined;
  }

  private static getPluginName(packageName: string) {
    if (packageName.endsWith(".js"))
      return packageName.substr(0, packageName.length - 3);
    return packageName;
  }

  /**
   * Loads a Plugin
   * @param packageName the name of the JavaScript file to be loaded from the web server.
   * @param args arguments that will be passed to the Plugin.onLoaded and Plugin.onExecute methods. If the first argument is not the plugin name, the plugin name will be prepended to the args array.
   */
  public static async loadPlugin(packageName: string, args?: string[]): Promise<Plugin> {
    // see if it is already loaded.
    const pluginName: string = PluginAdmin.getPluginName(packageName);

    // make sure there's an args and make sure the first element is the plugin name.
    if (!args) {
      args = [pluginName];
    } else {
      if ((args.length < 1) || (args[0] !== pluginName)) {
        const newArray: string[] = [pluginName];
        args = newArray.concat(args);
      }
    }

    const pendingPlugin = PluginAdmin._pendingPlugins.get(pluginName);
    if (undefined !== pendingPlugin) {
      // it has been loaded (or at least we have started to load it) already. If it is registered, call its reload method. (Otherwise reload called when we're done the initial load)
      const registeredPlugin = PluginAdmin._registeredPlugins.get(pluginName);
      if (registeredPlugin) {
        registeredPlugin.onExecute(args);
      }
      return pendingPlugin.promise;
    }

    // set it up to load.
    const newPendingPlugin: PendingPlugin = new PendingPlugin(packageName, args);

    // Javascript-ish saving of the arguments in the promise, so we can call reload with them.
    PluginAdmin._pendingPlugins.set(pluginName, newPendingPlugin);
    return newPendingPlugin.promise;
  }

  /**
   * Registers a Plugin with the PluginAdmin. This method is called by the Plugin when it is first loaded.
   * This method verifies that the required versions of the iModel.js system modules are loaded. If those
   * requirements are met, then the onLoad and onExecute methods of the Plugin will be called (@see [[Plugin]]).
   * If not, no further action is taken and the Plugin is not active.
   * @param plugin a newly instantiated subclass of Plugin.
   * @returns an array of error messages. The array will be empty if the load is successful, otherwise it is a list of one or more problems.
   */
  public static register(plugin: Plugin): string[] | undefined {
    const errorMessages = PluginAdmin.checkIModelJsVersions(plugin.versionsRequired);
    if (errorMessages) {
      // report load errors to the user.
      let allDetails: string = "";
      for (const thisMessage of errorMessages) {
        allDetails = allDetails.concat(thisMessage, "\n");
      }
      const briefMessage = IModelApp.i18n.translate("iModelJs:PluginErrors.VersionErrors", { pluginName: plugin.name });
      const errorDetails = new NotifyMessageDetails(OutputMessagePriority.Info, briefMessage, allDetails, OutputMessageType.Alert, OutputMessageAlert.Balloon);
      IModelApp.notifications.outputMessage(errorDetails);

      Logger.logError(loggerCategory, plugin.name + " failed to load. Error=" + allDetails);
      return errorMessages;
    }
    PluginAdmin._registeredPlugins.set(plugin.name, plugin);

    // log successful load after plugin is registered.
    Logger.logInfo(loggerCategory, plugin.name + " loaded");

    // retrieve the args we saved in the pendingPlugin.
    let args: string[] | undefined;
    const pendingPlugin = PluginAdmin._pendingPlugins.get(plugin.name);
    if (pendingPlugin) {
      pendingPlugin.resolve!(plugin);
      args = pendingPlugin.args;
    }

    if (!args)
      args = [plugin.name];

    plugin.onLoad(args);
    plugin.onExecute(args);
    return undefined;
  }

}
