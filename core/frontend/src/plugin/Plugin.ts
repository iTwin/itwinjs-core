/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Plugins */
import * as semver from "semver";
import { IModelApp } from "../IModelApp";
import { I18N, I18NOptions } from "@bentley/imodeljs-i18n";
import { ClientRequestContext, Logger } from "@bentley/bentleyjs-core";
import { request, Response, RequestOptions } from "@bentley/imodeljs-clients";

const loggerCategory = "imodeljs-frontend.Plugin";

type resolveFunc = ((arg: any) => void);
type rejectFunc = ((arg: Error) => void);

// @internal
interface PluginLoader {
  // initialize the loader
  initialize(pluginRootName: string): Promise<PluginLoadResults>;

  // returns an instance of I18N that can be reliably called from the Plugin.
  getI18n(): I18N;

  // returns a resource url given a url relative to the root of the plugin.
  resolveResourceUrl(relativeUrl: string): string;

  // returns the plugin root name from the keyed=in plugin specification
  getPluginRoot(pluginSpec: string): string;

  // get the plugin manifest from the tar file.
  getManifest(): Promise<any>;

  // load the plugin javascript from the tar file.
  loadPlugin(buildType: string, manifest: any, args?: string[]): Promise<PluginLoadResults>;
}

/**
 * Base Plugin class for writing a demand-loaded module.
 * @see [[PluginAdmin]] for a description of how Plugins are loaded.
 * @see [Plugins]($docs/learning/frontend/plugins.md)
 * @beta
 */
export abstract class Plugin {
  /**
   * Constructor for base Plugin class
   * @param name - the name of the plugin. When you use the buildIModelJsModule build script, this argument is filled in as the PLUGIN_NAME constant by webpack
   * @note Typically, a Plugin subclass is instantiated and registered with top-level JavaScript statements like these:
   * ```ts
   *  const myPlugin = new MyPlugin(PLUGIN_NAME);
   *  PluginAdmin.register(myPlugin);
   * ```
   */
  public constructor(public name: string) {
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

  private _loader: PluginLoader | undefined;
  /** @internal */
  public get loader(): PluginLoader | undefined { return this._loader; }
  /** @internal */
  public set loader(loader: PluginLoader | undefined) {
    this._loader = loader;
  }

  /** Returns a fully qualified resource URL (needed when the plugin is loaded from an external server
   * @param relativeUrl the url relative to the location specified for the Plugin URL.
   */
  public resolveResourceUrl(relativeUrl: string): string {
    if (!this._loader)
      throw (new Error("The register method must be called prior to using the i18n member of Plugin."));

    return this._loader.resolveResourceUrl(relativeUrl);
  }

  private _i18n: I18N | undefined;

  /** Property that retrieves the localization instance specific to the Plugin. */
  public get i18n(): I18N {
    if (this._i18n)
      return this._i18n;

    if (!this._loader)
      throw (new Error("The register method must be called prior to using the i18n member of Plugin."));

    return (this._i18n = this._loader.getI18n());
  }

  /** Can be used to set up a localization instance. Used only if non-standard treatment is required.
   * @param defaultNamespace
   * @param options
   */
  public setI18n(defaultNamespace?: string, options?: I18NOptions) {
    this._i18n = new I18N(defaultNamespace, options);
  }
}

/**
 * Returns Plugin load results
 * @beta
 */
export type PluginLoadResults = Plugin | undefined | string | string[];

// this private class represents a Plugin that we are attempting to load.
class PendingPlugin {
  public resolve: resolveFunc | undefined = undefined;
  public reject: rejectFunc | undefined = undefined;
  public promise: Promise<PluginLoadResults>;

  public constructor(public tarFileRoot: string, private _tarFileUrl: string, public loader: PluginLoader, public args?: string[]) {
    this.promise = new Promise(this.executor.bind(this));
  }

  public executor(resolve: resolveFunc, reject: rejectFunc) {
    this.resolve = resolve;
    this.reject = reject;

    const head = document.getElementsByTagName("head")[0];
    if (!head)
      reject(new Error("no head element found"));

    // create the script element. We handle onerror and resolve a PluginLoadResult failure in the onerror handler,
    // but we don't resolve success until the loaded plugin calls "register" (see Plugin.register)
    const scriptElement = document.createElement("script");

    scriptElement.onerror = this.cantLoad.bind(this);

    scriptElement.async = true;
    scriptElement.src = this._tarFileUrl;
    head.insertBefore(scriptElement, head.lastChild);
  }

  // called when we can't load the URL
  private cantLoad(_ev: string | Event) {
    this.resolve!(IModelApp.i18n.translate("iModelApp.PluginErrors.CantFind", { pluginUrl: this._tarFileUrl }));
  }
}

// this class reads the plugin from a plain server assuming that the user has untarred the tarfile into a directory from the called "imjs_plugins/<pluginName>"
// This loader is selected when the PluginAdmin.loadPlugin argument is of the form "<servername>/<pluginName>";
class ExternalServerPluginLoader implements PluginLoader {
  public serverName: string | undefined = undefined;
  private _pluginRootName: string | undefined = undefined;
  private _requestContext: ClientRequestContext;

  public constructor() {
    this._requestContext = new ClientRequestContext("");
  }

  public async initialize(fullPluginName: string): Promise<PluginLoadResults> {
    const slashPos: number = fullPluginName.lastIndexOf("/");
    // split apart the server name and plugin name.
    if (-1 === slashPos) {
      this._pluginRootName = fullPluginName;
      this.serverName = "imjs_plugins/".concat(this._pluginRootName, "/");
    } else {
      this._pluginRootName = fullPluginName.slice(slashPos + 1);
      const protocol: string = (fullPluginName.startsWith("localhost") || fullPluginName.startsWith("127.0.0.1")) ? "http://" : "https://";
      this.serverName = protocol.concat(fullPluginName.slice(0, slashPos), "/imjs_plugins/", this._pluginRootName, "/");
    }
    return Promise.resolve(undefined);
  }

  // The resources are being loaded from a server other than the application window.origin. Therefore a different I18N must be used with a different url template.
  public getI18n() {
    return new I18N("noDefaultNs", { urlTemplate: this.serverName!.concat("locales/{{lng}}/{{ns}}.json") });
  }

  public resolveResourceUrl(relativeUrl: string) {
    return this.serverName!.concat(relativeUrl);
  }

  // return the plugin name without the server name. Used to look up the registered name when determining whether the plugin is already loaded.
  public getPluginRoot(pluginSpec: string): string {
    const slashPos = pluginSpec.lastIndexOf("/");
    return pluginSpec.slice(slashPos + 1);
  }

  public async getManifest(): Promise<any> {
    const requestOptions: RequestOptions = {
      method: "GET",
      responseType: "json",
    };
    const url: string = this.serverName!.concat("manifest.json");
    const response: Response = await request(this._requestContext, url, requestOptions);
    return Promise.resolve(response.body);
  }

  public async loadPlugin(buildType: string, _manifest: any, args?: string[]): Promise<PluginLoadResults> {
    // the person setting up the server must have already untar'ed the plugin tar file. All we have to do is select the right file based on buildType.
    const jsFileUrl: string = this.serverName!.concat(buildType, "/", this._pluginRootName!, ".js");

    // set it up to load.
    const newPendingPlugin: PendingPlugin = new PendingPlugin(this._pluginRootName!, jsFileUrl, this, args);

    // Javascript-ish saving of the arguments in the promise, so we can call onLoad with them.
    PluginAdmin.addPendingPlugin(this._pluginRootName!, newPendingPlugin);
    return newPendingPlugin.promise;
  }
}

class ServerAssistedPluginLoader implements PluginLoader {
  private _pluginRootName: string | undefined;
  private _requestContext: ClientRequestContext;

  public constructor() {
    this._requestContext = new ClientRequestContext("");
  }

  public async initialize(pluginRootName: string): Promise<PluginLoadResults> {
    this._pluginRootName = pluginRootName;

    const tarFileName: string = PluginAdmin.getTarFileName(pluginRootName);

    const requestOptions: RequestOptions = {
      method: "POST",
      responseType: "json",
      body: { name: tarFileName },
    };
    try {
      const response: Response = await request(this._requestContext, "/plugin", requestOptions);
      if (response.body.i18nKey) {
        // The response always returns 200 (success), even if there are problems. We use the text in the response to indicate a problem.
        // response.body.i18nKey is the key to look up in the localization system. The other contents of response.body are sent to i81n.translate to be injected into the message.
        // possible problem keys:
        // iModelJs:PluginErrors.CantFind - Plugin is not on server.
        // iModelJs:PluginErrors.CantUntar - Untar step fails.
        // iModelJs:PluginErrors.NotAuthorized - not authorized to access the specified Plugin
        // iModelJs:PluginErrors.SignatureNoMatch - the Plugin is signed but the signature does not verify correctly.
        // iModelJs:PluginErrors.
        return Promise.resolve(IModelApp.i18n.translate(response.body.i18nKey, { tarFileName, ...response.body }));
      }
      return Promise.resolve(undefined);
    } catch (error) {
      // this shouldn't happen
      return Promise.resolve([IModelApp.i18n.translate("iModelJs:PluginErrors.CantLoad", { pluginUrl: tarFileName }), error.toString]);
    }
  }

  // gets I18N for plugin to use. Since the resources for this loader are coming from the same origin, can just use IModelApp.i18n.
  public getI18n() {
    return IModelApp.i18n;
  }

  // We could figure out something better - extracting the blob and making a blob url.
  public resolveResourceUrl(relativeUrl: string) {
    return relativeUrl;
  }

  public getPluginRoot(pluginSpec: string): string {
    return pluginSpec;
  }

  public async getManifest(): Promise<any> {
    const requestOptions: RequestOptions = {
      method: "GET",
      responseType: "json",
    };
    const url: string = "/plugins/".concat(this._pluginRootName!, "/", "manifest.json");
    const response: Response = await request(this._requestContext, url, requestOptions);
    return Promise.resolve(response.body);
  }

  public async loadPlugin(buildType: string, _manifest: any, args?: string[]): Promise<PluginLoadResults> {
    // the initialize method has untar'ed the plugin tar file. All we have to do is select the right file based on buildType.
    const jsFileUrl: string = "/plugins/".concat(this._pluginRootName!, "/", buildType, "/", this._pluginRootName!, ".js");

    // set it up to load.
    const newPendingPlugin: PendingPlugin = new PendingPlugin(this._pluginRootName!, jsFileUrl, this, args);

    // Javascript-ish saving of the arguments in the promise, so we can call onLoad with them.
    PluginAdmin.addPendingPlugin(this._pluginRootName!, newPendingPlugin);
    return newPendingPlugin.promise;
  }
}

// information for a required system module.
class RequiredModule {
  constructor(public name: string, public version: string) { }
}

// class that keeps track of the system modules, checks their versions, and loads them if necessary.
class SystemModuleResults {
  public errorMessages: string[] | undefined;
  private _notYetLoadedModules: RequiredModule[] | undefined;
  public constructor() {
  }

  public addErrorMessage(message: string) {
    if (!this.errorMessages)
      this.errorMessages = [];
    this.errorMessages.push(message);
  }

  public addNotYetLoadedModule(moduleName: string, version: string) {
    if (!this._notYetLoadedModules)
      this._notYetLoadedModules = [];
    this._notYetLoadedModules.push(new RequiredModule(moduleName, version));
  }

  // gets the version of a system module that is available on the server. Has to ask the server.
  private async getAvailableModuleVersion(moduleName: string): Promise<string | undefined> {
    const requestContext = new ClientRequestContext("");
    const requestOptions: RequestOptions = {
      method: "POST",
      responseType: "text",
      body: { name: moduleName },
    };
    try {
      const response: Response = await request(requestContext, "/versionAvailable", requestOptions);
      if (response.text && response.text.length > 0)
        return Promise.resolve(response.text);
      return Promise.resolve(undefined);
    } catch (error) {
      // couldn't get a version available
      return Promise.reject(error);
    }
  }

  // loads a particular system module.
  public async loadModule(moduleName: string | undefined): Promise<void> {
    // if there is no module, just return resolve promise.
    if (!moduleName) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const head = document.getElementsByTagName("head")[0];
      if (!head)
        reject(new Error("no head element found"));

      // create the script element. handle onload and onerror.
      const scriptElement = document.createElement("script");
      scriptElement.onload = () => {
        scriptElement.onload = null;
        resolve();
      };
      scriptElement.onerror = (ev) => {
        scriptElement.onload = null;
        reject(new Error("can't load " + moduleName + " : " + ev));
      };
      scriptElement.async = true;
      scriptElement.src = moduleName;
      head.insertBefore(scriptElement, head.lastChild);
    });
  }

  // loads an individual system module.
  private async loadRequiredModule(needsLoading: RequiredModule): Promise<void> {
    // see if the module is available by asking the server, getting its version.
    const strippedModuleName = needsLoading.name.slice(9);
    try {
      const versionFound: string | undefined = await this.getAvailableModuleVersion(needsLoading.name);
      if (versionFound) {
        if (!semver.satisfies(versionFound, needsLoading.version)) {
          this.addErrorMessage(IModelApp.i18n.translate("iModelJs:PluginErrors.VersionMismatch", { versionFound, moduleName: strippedModuleName, versionRequired: needsLoading.version }));
          return;
        } else {
          const fullModuleName = "v".concat(versionFound, "/", strippedModuleName, ".js");
          await this.loadModule(fullModuleName);
          return;
        }
      }
    } catch (error) { }
    // if we didn't return above, that's because we either didn't find a loadable version, or loading failed.
    this.addErrorMessage(IModelApp.i18n.translate("iModelJs:PluginErrors.ModuleNotLoaded", { moduleName: strippedModuleName }));
  }

  // loads all the system modules that are needed but not yet required.
  // NOTE: This currently assumes that the remaining required modules can be loaded in any order. That will be true if
  // they all depend only on "core" system modules, but not if the depend on each other somehow. If that case arises,
  // the list of required modules will have to be sorted.
  public async loadRequiredModules(): Promise<void> {
    // check if there are any that need loading.
    if (this._notYetLoadedModules) {
      for (const needsLoading of this._notYetLoadedModules) {
        try {
          await this.loadRequiredModule(needsLoading);
        } catch (error) {
          return Promise.reject(error);
        }
      }
    }
    return Promise.resolve();
  }
}

/**
 * Controls loading of Plugins and calls methods on newly loaded or reloaded Plugins
 * @beta
 */
export class PluginAdmin {
  private static _pendingPlugins: Map<string, PendingPlugin> = new Map<string, PendingPlugin>();
  private static _registeredPlugins: Map<string, Plugin> = new Map<string, Plugin>();
  private static _useServerAssistedLoader: Promise<boolean> | undefined;

  // @internal
  public static addPendingPlugin(pluginRootName: string, pendingPlugin: PendingPlugin) {
    PluginAdmin._pendingPlugins.set(pluginRootName, pendingPlugin);
  }

  // @internal
  public static getTarFileName(pluginRootName: string): string {
    // if it doesn't end in plugin.tar, append that.
    return pluginRootName.endsWith(".plugin.tar") ? pluginRootName : pluginRootName.concat(".plugin.tar");
  }

   // @internal
  public static getRegisteredPlugin(pluginName: string): Promise<PluginLoadResults> | undefined {
    // strip off .js if necessary
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
  private static checkIModelJsVersions(versionsRequired: any): SystemModuleResults {
    const results = new SystemModuleResults();
    // make sure we're in a browser-like environment
    if ((typeof window === "undefined") || !window) {
      results.addErrorMessage(IModelApp.i18n.translate("iModelJs:PluginErrors.FrontEndOnly"));
      return results;
    }
    const versionsLoaded: Map<string, string> = (window as any).iModelJsVersions;
    if (!versionsLoaded) {
      results.addErrorMessage(IModelApp.i18n.translate("iModelJs:PluginErrors.NoVersionsLoaded"));
      return results;
    }

    // make sure the versionsRequired string isn't empty.
    if (!versionsRequired) {
      results.addErrorMessage(IModelApp.i18n.translate("iModelJs:PluginErrors.PackagedIncorrectly"));
      return results;
    }

    // find loaded version, or add the module to the list that still needs to be loaded.
    try {
      for (const moduleName of Object.getOwnPropertyNames(versionsRequired)) {
        if (!moduleName.startsWith("@bentley"))
          continue;
        const strippedModuleName = moduleName.slice(9);
        const versionRequired: string = versionsRequired[moduleName];
        if (!versionRequired || "string" !== typeof (versionRequired)) {
          results.addErrorMessage(IModelApp.i18n.translate("iModelJs:PluginErrors.NoVersionSpecified", { moduleName: strippedModuleName }));
        } else {
          // remove the "@bentley/" part. On startup, the modules store the part after that.
          const versionLoaded = versionsLoaded.get(strippedModuleName);
          if (!versionLoaded) {
            // here we haven't loaded one of the required modules. We can try to load it here.
            results.addNotYetLoadedModule(moduleName, versionRequired);
          } else {
            // check version required vs. version loaded.
            if (!semver.satisfies(versionLoaded, versionRequired)) {
              results.addErrorMessage(IModelApp.i18n.translate("iModelJs:PluginErrors.VersionMismatch", { versionLoaded, moduleName: strippedModuleName, versionRequired }));
            }
          }
        }
      }
    } catch (err) {
      results.addErrorMessage(IModelApp.i18n.translate("iModelJs:PluginErrors.PackagedIncorrectly"));
    }
    return results;
  }

  /**
   * Loads a Plugin
   * @param pluginRoot the root name of the Plugin to be loaded from the web server.
   * @param args arguments that will be passed to the Plugin.onLoaded and Plugin.onExecute methods. If the first argument is not the plugin name, the plugin name will be prepended to the args array.
   */
  public static async loadPlugin(pluginSpec: string, args?: string[]): Promise<PluginLoadResults> {

    // select one of the plugin loaders. If there is a / in the Plugin name, or we can't use the serverAssistedLoader (the web server doesn't support untarring Plugin Tar files) use the ExternalServerPluginLoader.
    const pluginLoader: PluginLoader = await PluginAdmin.determinePluginLoader(pluginSpec);
    const pluginRoot = pluginLoader.getPluginRoot(pluginSpec);

    // make sure there's an args and make sure the first element is the plugin name.
    if (!args) {
      args = [pluginRoot];
    } else {
      if ((args.length < 1) || (args[0] !== pluginRoot)) {
        const newArray: string[] = [pluginRoot];
        args = newArray.concat(args);
      }
    }

    const pendingPlugin = PluginAdmin._pendingPlugins.get(pluginRoot);
    if (undefined !== pendingPlugin) {
      // it has been loaded (or at least we have started to load it) already. If it is registered, call its reload method. (Otherwise reload called when we're done the initial load)
      const registeredPlugin = PluginAdmin._registeredPlugins.get(pluginRoot);
      if (registeredPlugin) {
        registeredPlugin.onExecute(args);
      }
      return pendingPlugin.promise;
    }

    let manifest: any;

    try {
      const initializeResults: PluginLoadResults = await pluginLoader.initialize(pluginSpec);
      if (initializeResults && ("string" === typeof (initializeResults) || Array.isArray(initializeResults)))
        return initializeResults;

      manifest = await pluginLoader.getManifest();
    } catch (error) {
      return Promise.resolve(IModelApp.i18n.translate("iModelJs:PluginErrors.NoManifest"));
    }

    if (!manifest.bundleName)
      return Promise.resolve(IModelApp.i18n.translate("iModelJs:PluginErrors.ManifestMember", { propertyName: "bundleName" }));

    if (!manifest.versionsRequired)
      return Promise.resolve(IModelApp.i18n.translate("iModelJs:PluginErrors.ManifestMember", { propertyName: "versionsRequired" }));

    const results: SystemModuleResults = PluginAdmin.checkIModelJsVersions(manifest.versionsRequired);
    // if we have no errors so far, but there are unloaded modules required, try to load them now.
    if (!results.errorMessages) {
      await results.loadRequiredModules();
    }
    // if there no errors, we have successfully loaded all the required modules.
    if (results.errorMessages) {
      return Promise.resolve(results.errorMessages);
    }

    // Now that we know we have the required modules, we will load the actual bundle.
    // If we get this far, we know that window.iModelJsVersions is fine. Get the deployment type from it.
    const buildType = (window as any).iModelJsVersions.get("buildType");
    if (!buildType)
      return Promise.reject("buildType not found in iModelJsVersions");

    return pluginLoader.loadPlugin(buildType, manifest, args);
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
    PluginAdmin._registeredPlugins.set(plugin.name, plugin);

    // log successful load after plugin is registered.
    Logger.logInfo(loggerCategory, plugin.name + " registered");

    // retrieve the args we saved in the pendingPlugin.
    let args: string[] | undefined;
    const pendingPlugin = PluginAdmin._pendingPlugins.get(plugin.name);
    if (pendingPlugin) {
      pendingPlugin.resolve!(plugin);
      plugin.loader = pendingPlugin.loader;
      args = pendingPlugin.args;
    }

    if (!args)
      args = [plugin.name];

    plugin.onLoad(args);
    plugin.onExecute(args);
    return undefined;
  }

  // If the Plugin is "local" (no "/" in the name), checks to see whether the web server supports untarring the plugin.
  private static async determinePluginLoader(pluginSpec: string): Promise<PluginLoader> {
    if (-1 !== pluginSpec.indexOf("/")) {
      return new ExternalServerPluginLoader();
    } else {
      if (!PluginAdmin._useServerAssistedLoader)
        PluginAdmin._useServerAssistedLoader = PluginAdmin.determineLocalHostLoader();
      const useServerAssistedLoader: boolean = await (PluginAdmin._useServerAssistedLoader);
      return useServerAssistedLoader ? new ServerAssistedPluginLoader() : new ExternalServerPluginLoader();
    }
  }

  // this is executed from determinePluginLoader the first time a Plugin (without "/" in the spec) is loaded.
  private static async determineLocalHostLoader(): Promise<boolean> {
    try {
      // probe the server to determine whether it supports untarring the plugin.
      const requestOptions: RequestOptions = { method: "POST", responseType: "json" };
      const requestContext: ClientRequestContext = new ClientRequestContext();
      // on success, we set _useServerAssistedLoader to true. On fail, we leave it set to false.
      await request(requestContext, "/pluginTarSupport", requestOptions);
      return Promise.resolve(true);
    } catch (err) {
      return Promise.resolve(false);
    }
  }
}
