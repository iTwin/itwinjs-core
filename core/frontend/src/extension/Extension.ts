/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Extensions
 */
import * as semver from "semver";
import { I18N, I18NOptions } from "@bentley/imodeljs-i18n";
import { ClientRequestContext, Logger } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext, request, Response, RequestOptions, SettingsResult, SettingsStatus, Config } from "@bentley/imodeljs-clients";

import { IModelApp } from "../IModelApp";
import { NotifyMessageDetails, OutputMessageAlert, OutputMessagePriority, OutputMessageType } from "../NotificationManager";

const loggerCategory = "imodeljs-frontend.Extension";

type resolveFunc = ((arg: any) => void);
type rejectFunc = ((arg: Error) => void);

/**  The structure expected of a `manifest.json` file from a extension
 * @internal
 */
interface Manifest {
  bundleName?: string;
  devPlugin?: string;
  versionsRequired?: {
    [moduleName: string]: string;
  };
}

// @internal
interface ExtensionLoader {
  // initialize the loader
  initialize(extensionRootName: string): Promise<ExtensionLoadResults>;

  // returns an instance of I18N that can be reliably called from the Extension.
  getI18n(): I18N;

  // returns a resource url given a url relative to the root of the extension.
  resolveResourceUrl(relativeUrl: string): string;

  // returns the extension root name from the keyed-in extension specification
  getExtensionRoot(extensionSpec: string): string;

  // get the extension manifest from the tar file.
  getManifest(): Promise<Manifest>;

  // load the extension javascript from the tar file.
  loadExtension(buildType: string, manifest: any, args?: string[]): Promise<ExtensionLoadResults>;
}

/**
 * Base Extension class for writing a demand-loaded module.
 * @see [[ExtensionAdmin]] for a description of how Extensions are loaded.
 * @see [Extensions]($docs/learning/frontend/extensions.md)
 * @beta
 */
export abstract class Extension {
  /** Constructor for base Extension class
   * @param name - the name of the extension.
   * @note Typically, an Extension subclass is instantiated and registered with top-level JavaScript statements like these:
   * ```ts
   *  const myExtension = new MyExtension(EXTENSION_NAME);
   *  IModelApp.extensionAdmin.register(myExtension);
   * ```
   */
  public constructor(public name: string) {
  }

  /** Method called when the Extension is first loaded.
   * @param _args arguments that were passed to [ExtensionAdmin.loadExtension]($frontend). The first argument is the extension name.
   */
  public onLoad(_args: string[]): void {
  }

  /** Method called immediately following the call to onLoad when the Extension is first loaded, and also once for
   * each additional call to [ExtensionAdmin.loadExtension]($frontend) for the same Extension.
   * @param _args arguments that were passed to [ExtensionAdmin.loadExtension]($frontend). The first argument is the extension name.
   */
  public abstract onExecute(_args: string[]): void;

  private _loader: ExtensionLoader | undefined;
  /** @internal */
  public get loader(): ExtensionLoader | undefined { return this._loader; }
  public set loader(loader: ExtensionLoader | undefined) {
    this._loader = loader;
  }

  /** Returns a fully qualified resource URL which is needed when the extension is loaded from an external server
   * @param relativeUrl the url relative to the location specified for the Extension URL.
   */
  public resolveResourceUrl(relativeUrl: string): string {
    if (!this._loader)
      throw new Error("The register method must be called prior to using the resolveRelativeUrl method of Extension.");

    return this._loader.resolveResourceUrl(relativeUrl);
  }

  private _i18n: I18N | undefined;

  /** Property that retrieves the localization instance specific to the Extension. */
  public get i18n(): I18N {
    if (this._i18n)
      return this._i18n;

    if (!this._loader)
      throw new Error("The register method must be called prior to using the i18n member of Extension.");

    return (this._i18n = this._loader.getI18n());
  }

  /** Can be used to set up a localization instance. Used only if non-standard treatment is required.
   * @param defaultNamespace
   * @param options
   */
  public setI18n(defaultNamespace?: string, options?: I18NOptions) {
    this._i18n = new I18N(defaultNamespace, options);
  }

  /** When a Extension has been loaded, and there is a subsequent call to load the same Extension,
   * returning false from this method prevents the system from reporting the reload.
   */
  public reportReload(): boolean {
    return true;
  }
}

/**
 * Returns Extension load results
 * @beta
 */
export type ExtensionLoadResults = Extension | undefined | string | string[];

// this private class represents a Extension that we are attempting to load.
class PendingExtension {
  public resolve: resolveFunc | undefined = undefined;
  public reject: rejectFunc | undefined = undefined;
  public promise: Promise<ExtensionLoadResults>;

  public constructor(public tarFileRoot: string, private _tarFileUrl: string, public loader: ExtensionLoader, public args?: string[]) {
    this.promise = new Promise(this.executor.bind(this));
  }

  public executor(resolve: resolveFunc, reject: rejectFunc) {
    this.resolve = resolve;
    this.reject = reject;

    const head = document.getElementsByTagName("head")[0];
    if (!head)
      reject(new Error("no head element found"));

    // create the script element. We handle onerror and resolve a ExtensionLoadResult failure in the onerror handler,
    // but we don't resolve success until the loaded extension calls "register" (see Extension.register)
    const scriptElement = document.createElement("script");

    scriptElement.onerror = this.cantLoad.bind(this);

    scriptElement.async = true;
    scriptElement.src = this._tarFileUrl;
    head.insertBefore(scriptElement, head.lastChild);
  }

  // called when we can't load the URL
  private cantLoad(_ev: string | Event) {
    this.resolve!(IModelApp.i18n.translate("iModelJs:ExtensionErrors.CantFind", { extensionUrl: this._tarFileUrl }));
  }
}

/** Reads the extension from a plain server assuming that the extension is a set of files in a directory formatted as "imjs_extensions/<extensionName>".
 *
 * This loader is selected when the ExtensionAdmin.loadExtension argument is of the form "<servername>/<extensionName>";
 */
class ExternalServerExtensionLoader implements ExtensionLoader {
  public serverName?: string = undefined;
  private _extensionRootName?: string | undefined = undefined;

  public constructor(private _extensionAdmin: ExtensionAdmin) { }

  /** Initializes the extension loader for the provided extension name.
   *
   * - A trailing '/' is not supported in the full extension name.
   * - Prepends 'http' to the fullExtensionName if the it starts with "localhost" or "127.0.0.1"
   * - Prepends 'https' if the fullExtensionName is missing an http and https
   *
   * @param fullExtensionName The name or url to the location of the extension.
   */
  public async initialize(fullExtensionName: string): Promise<ExtensionLoadResults> {
    const slashPos: number = fullExtensionName.lastIndexOf("/");

    // The fullExtensionName is not a url
    if (-1 === slashPos) {
      this._extensionRootName = fullExtensionName;
      this.serverName = "imjs_extensions/".concat(this._extensionRootName, "/");
    } else {
      // split apart the server name and extension name.
      this._extensionRootName = fullExtensionName.slice(slashPos + 1);

      let extensionServerUrl = "";
      if (!fullExtensionName.startsWith("http") || !fullExtensionName.startsWith("https"))
        extensionServerUrl += (fullExtensionName.startsWith("localhost") || fullExtensionName.startsWith("127.0.0.1")) ? "http://" : "https://";

      this.serverName = extensionServerUrl.concat(fullExtensionName.slice(0, slashPos), "/imjs_extensions/", this._extensionRootName, "/");
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

  /** Return the extension name without the server name. Used to look up the registered name when determining whether the extension is already loaded. */
  public getExtensionRoot(extensionSpec: string): string {
    const slashPos = extensionSpec.lastIndexOf("/");
    return extensionSpec.slice(slashPos + 1);
  }

  public async getManifest(): Promise<Manifest> {
    const url: string = this.serverName!.concat("manifest.json");
    const response = await fetch(url);
    return response.json();
  }

  public async loadExtension(buildType: string, _manifest: Manifest, args?: string[]): Promise<ExtensionLoadResults> {
    const jsFileUrl: string = this.serverName!.concat(buildType, "/", _manifest.bundleName!, ".js");

    // set it up to load.
    const newPendingExtension: PendingExtension = new PendingExtension(this._extensionRootName!, jsFileUrl, this, args);

    // Javascript-ish saving of the arguments in the promise, so we can call onLoad with them.
    this._extensionAdmin.addPendingExtension(this._extensionRootName!, newPendingExtension);
    return newPendingExtension.promise;
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
    const requestContext = new ClientRequestContext("GetAvailableVersions");
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
          this.addErrorMessage(IModelApp.i18n.translate("iModelJs:ExtensionErrors.VersionMismatch", { versionFound, moduleName: strippedModuleName, versionRequired: needsLoading.version }));
          return;
        } else {
          const fullModuleName = "v".concat(versionFound, "/", strippedModuleName, ".js");
          await this.loadModule(fullModuleName);
          return;
        }
      }
    } catch (error) { }
    // if we didn't return above, that's because we either didn't find a loadable version, or loading failed.
    this.addErrorMessage(IModelApp.i18n.translate("iModelJs:ExtensionErrors.ModuleNotLoaded", { moduleName: strippedModuleName }));
  }

  // Loads all the system modules that are needed but not yet required.
  // NOTE: This currently assumes that the remaining required modules can be loaded in any order. That will be true if
  // they all depend only on "core" system modules, but not if the depend on each other somehow. If that case arises,
  // the list of required modules will have to be sorted.
  public async loadRequiredModules(): Promise<void> {
    if (undefined === this._notYetLoadedModules)
      return;

    // check if there are any that need loading.
    for (const needsLoading of this._notYetLoadedModules) {
      try {
        await this.loadRequiredModule(needsLoading);
      } catch (error) {
        return Promise.reject(error);
      }
    }
  }
}

/**
 * Controls loading of Extension and calls methods on newly loaded or reloaded Extensions
 * @beta
 */
export class ExtensionAdmin {

  public constructor() { }

  public onInitialized() {
    // on view startup, we load the saved extensions that should be view
    IModelApp.viewManager.onViewOpen.addOnce(this.loadViewStartupExtensions.bind(this));
  }

  private _pendingExtensions: Map<string, PendingExtension> = new Map<string, PendingExtension>();
  private _registeredExtensions: Map<string, Extension> = new Map<string, Extension>();
  private _viewStartupExtensionsLoaded: boolean = false;

  /** @internal */
  public addPendingExtension(extensionRootName: string, pendingExtension: PendingExtension) {
    const extensionNameLC = extensionRootName.toLowerCase();
    this._pendingExtensions.set(extensionNameLC, pendingExtension);
  }

  /** @internal */
  public getRegisteredExtension(extensionName: string): Promise<ExtensionLoadResults> | undefined {
    // lowercase name.
    const extensionNameLC = extensionName.toLowerCase();
    const extension = this._registeredExtensions.get(extensionNameLC);
    if (extension)
      return Promise.resolve(extension);
    const extensionPromise = this._pendingExtensions.get(extensionNameLC);
    if (extensionPromise) {
      return extensionPromise.promise;
    }
    return undefined;
  }

  // returns an array of strings with version mismatch errors, or undefined if the versions of all modules are usable.
  private checkIModelJsVersions(versionsRequired: any): SystemModuleResults {
    const results = new SystemModuleResults();
    // make sure we're in a browser-like environment
    if ((typeof window === "undefined") || !window) {
      results.addErrorMessage(IModelApp.i18n.translate("iModelJs:ExtensionErrors.FrontEndOnly"));
      return results;
    }
    const versionsLoaded: Map<string, string> = (window as any).iModelJsVersions;
    if (!versionsLoaded) {
      results.addErrorMessage(IModelApp.i18n.translate("iModelJs:ExtensionErrors.NoVersionsLoaded"));
      return results;
    }

    const versionRequiredArr = Object.getOwnPropertyNames(versionsRequired);

    // make sure the versionsRequired string isn't empty.
    if (0 === versionRequiredArr.length) {
      results.addErrorMessage(IModelApp.i18n.translate("iModelJs:ExtensionErrors.PackagedIncorrectly"));
      return results;
    }

    // find loaded version, or add the module to the list that still needs to be loaded.
    try {
      for (const moduleName of versionRequiredArr) {
        if (!moduleName.startsWith("@bentley"))
          continue;
        const strippedModuleName = moduleName.slice(9);
        const versionRequired: string = versionsRequired[moduleName];
        if (!versionRequired || "string" !== typeof (versionRequired)) {
          results.addErrorMessage(IModelApp.i18n.translate("iModelJs:ExtensionErrors.NoVersionSpecified", { moduleName: strippedModuleName }));
          continue;
        }

        // On startup, the modules store the part after that.
        const versionLoaded = versionsLoaded.get(strippedModuleName);
        if (!versionLoaded) {
          // here we haven't loaded one of the required modules. We can try to load it here.
          results.addNotYetLoadedModule(moduleName, versionRequired);
        } else if (!semver.satisfies(versionLoaded, versionRequired)) {
          // check version required vs. version loaded.
          results.addErrorMessage(IModelApp.i18n.translate("iModelJs:ExtensionErrors.VersionMismatch", { versionLoaded, moduleName: strippedModuleName, versionRequired }));
        }
      }
    } catch (err) {
      results.addErrorMessage(IModelApp.i18n.translate("iModelJs:ExtensionErrors.PackagedIncorrectly"));
    }
    return results;
  }

  /**
   * Loads a Extension
   * @param extensionRoot the root name of the Extension to be loaded from the web server.
   * @param args arguments that will be passed to the Extension.onLoaded and Extension.onExecute methods. If the first argument is not the extension name, the extension name will be prepended to the args array.
   */
  public async loadExtension(extensionRoot: string, args?: string[]): Promise<ExtensionLoadResults> {

    // select one of the extension loaders. If there is a / in the Extension name
    const extensionLoader: ExtensionLoader = await this.determineExtensionLoader();
    const extensionName = extensionLoader.getExtensionRoot(extensionRoot);

    // make sure there's an args and make sure the first element is the extension name.
    if (!args) {
      args = [extensionName];
    } else {
      if ((args.length < 1) || (args[0] !== extensionName)) {
        const newArray: string[] = [extensionName];
        args = newArray.concat(args);
      }
    }

    const extensionNameLC = extensionName.toLowerCase();
    const pendingExtension = this._pendingExtensions.get(extensionNameLC);
    if (undefined !== pendingExtension) {
      // it has been loaded (or at least we have started to load it) already. If it is registered, call its reload method. (Otherwise reload called when we're done the initial load)
      const registeredExtension = this._registeredExtensions.get(extensionNameLC);
      if (registeredExtension) {
        // extension is already loaded.
        registeredExtension.onExecute(args);
        if (!registeredExtension.reportReload())
          return undefined;
      }
      return pendingExtension.promise;
    }

    let manifest: Manifest | undefined;

    try {
      const initializeResults: ExtensionLoadResults = await extensionLoader.initialize(extensionRoot);
      if (initializeResults && ("string" === typeof (initializeResults) || Array.isArray(initializeResults)))
        return initializeResults;

      manifest = await extensionLoader.getManifest();
    } catch (error) {
      return Promise.resolve(IModelApp.i18n.translate("iModelJs:ExtensionErrors.NoManifest"));
    }

    if (!manifest.bundleName)
      return Promise.resolve(IModelApp.i18n.translate("iModelJs:ExtensionErrors.ManifestMember", { propertyName: "bundleName" }));

    if (!manifest.versionsRequired)
      return Promise.resolve(IModelApp.i18n.translate("iModelJs:ExtensionErrors.ManifestMember", { propertyName: "versionsRequired" }));

    const results: SystemModuleResults = this.checkIModelJsVersions(manifest.versionsRequired);
    // if we have no errors so far, but there are unloaded modules required, try to load them now.
    if (!results.errorMessages) {
      await results.loadRequiredModules();
    }
    // if there no errors, we have successfully loaded all the required modules.
    if (results.errorMessages)
      return results.errorMessages;

    // Now that we know we have the required modules, we will load the actual bundle.
    // If we get this far, we know that window.iModelJsVersions is fine. Get the deployment type from it.
    const buildType = (window as any).iModelJsVersions.get("buildType");
    if (!buildType)
      return Promise.reject("buildType not found in iModelJsVersions");

    return extensionLoader.loadExtension(buildType, manifest, args);
  }

  /**
   * Registers a Extension with the ExtensionAdmin. This method is called by the Extension when it is first loaded.
   * This method verifies that the required versions of the iModel.js system modules are loaded. If those
   * requirements are met, then the onLoad and onExecute methods of the Extension will be called (@see [[Extension]]).
   * If not, no further action is taken and the Extension is not active.
   * @param extension a newly instantiated subclass of Extension.
   * @returns an array of error messages. The array will be empty if the load is successful, otherwise it is a list of one or more problems.
   */
  public register(extension: Extension): string[] | undefined {
    const extensionNameLC = extension.name.toLowerCase();
    this._registeredExtensions.set(extensionNameLC, extension);

    // log successful load after extension is registered.
    Logger.logInfo(loggerCategory, extension.name + " registered");

    // retrieve the args we saved in the pendingExtension.
    let args: string[] | undefined;
    const pendingExtension = this._pendingExtensions.get(extensionNameLC);
    if (pendingExtension) {
      pendingExtension.resolve!(extension);
      extension.loader = pendingExtension.loader;
      args = pendingExtension.args;
    } else {
      throw new Error("Pending Extension not found.");
    }

    if (!args)
      args = [extension.name];

    extension.onLoad(args);
    extension.onExecute(args);
    return undefined;
  }

  // If the Extension is "local" (no "/" in the name)
  private async determineExtensionLoader(): Promise<ExtensionLoader> {
    // TODO:  Need to add support for the Extension Service loading possibility.  Not sure the current order of loading but
    // if (-1 !== pluginSpec.indexOf("/"))
    return new ExternalServerExtensionLoader(this);
  }

  /** @internal */
  public async loadViewStartupExtensions(): Promise<void> {
    if (this._viewStartupExtensionsLoaded)
      return;

    if (!IModelApp.authorizationClient)
      return;

    const accessToken = await IModelApp.authorizationClient!.getAccessToken();
    if (!accessToken)
      return;

    this._viewStartupExtensionsLoaded = true;
    const requestContext = new AuthorizedClientRequestContext(accessToken, "loadStartupExtension");

    // load user/app specific extensions.
    const extensionsLoadResults: LoadSavedExtensionsResult = await this.loadSavedExtensions(requestContext, "StartViewExtensions");
    extensionsLoadResults.report();
  }

  private async getExtensionsList(requestContext: AuthorizedClientRequestContext, settingName: string, allUsers: boolean): Promise<SavedExtension[] | undefined> {
    let settingsResult: SettingsResult;
    if (allUsers)
      settingsResult = await IModelApp.settings.getSetting(requestContext, "SavedExtensions", settingName, true);
    else
      settingsResult = await IModelApp.settings.getUserSetting(requestContext, "SavedExtensions", settingName, true);

    if (SettingsStatus.Success !== settingsResult.status)
      return undefined;

    return settingsResult.setting.extensions as SavedExtension[];
  }

  private getConfigExtensionList(configVarName: string): SavedExtension[] | undefined {
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
   * @internal
   * Returns the status of loading the extensions.
   * @param requestContext The client request context
   * @param settingName The name of the setting (or the name of the configuration variable when requesting extensions from a configuration variable).
   * @param userSettings If true, looks up the settingName application-specific user setting, in settings namespace "SavedExtensions", to find the list of extensions to load. Defaults to true.
   * @param appSettings If true, looks up the application-specific (i.e., all users) setting, in settings namespace "SavedExtensions", to find the list of extensions to load. Defaults to true.
   * @param configuration If true, retrieves the configuration variable "SavedExtensions.<settingName>" to get the list of extensions to load. Defaults to true.
   */
  public async loadSavedExtensions(requestContext: AuthorizedClientRequestContext, settingName: string, userSettings?: boolean, appSettings?: boolean, configuration?: boolean): Promise<LoadSavedExtensionsResult> {
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
      return Promise.resolve(new LoadSavedExtensionsResult(LoadSavedExtensionsStatus.NoSavedExtensions));

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
        extensionPromises.push(this.loadExtension(extensionName, extensionArgs));
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
        return Promise.resolve(new LoadSavedExtensionsResult(LoadSavedExtensionsStatus.AllExtensionsFailedToLoad, "iModelJs:ExtensionErrors.AllSavedExtensionsFailed", allExtensionResults));
      } else if (atLeastOneFail) {
        return Promise.resolve(new LoadSavedExtensionsResult(LoadSavedExtensionsStatus.SomeExtensionsFailedToLoad, "iModelJs:ExtensionErrors.SomeSavedExtensionsFailed", allExtensionResults));
      } else {
        return Promise.resolve(new LoadSavedExtensionsResult(LoadSavedExtensionsStatus.Success, "iModelJs:ExtensionErrors.SavedExtensionsSuccess", allExtensionResults));
      }
    } catch (err) {
      return Promise.resolve(new LoadSavedExtensionsResult(LoadSavedExtensionsStatus.LoadError, err.toString));
    }
  }

  /** Adds a extension to settings to be opened by loadSavedExtensions.
   * @beta
   */
  public async addSavedExtensions(requestContext: AuthorizedClientRequestContext, extensionName: string, args: string[] | undefined, allUsers: boolean, settingName: string) {
    // retrieve the setting specified so we can append to it.
    let settingsResult: SettingsResult;
    let settings: ExtensionSetting | undefined;
    if (allUsers) {
      settingsResult = await IModelApp.settings.getSetting(requestContext, "SavedExtensions", settingName, true, undefined, undefined);
    } else {
      settingsResult = await IModelApp.settings.getUserSetting(requestContext, "SavedExtension", settingName, true, undefined, undefined);
    }

    if (settingsResult.status !== SettingsStatus.Success) {
      // create new setting.
      settings = new ExtensionSetting([]);
    } else {
      settings = settingsResult.setting as ExtensionSetting;
    }
    settings.extensions.push(new SavedExtension(extensionName, args));
    if (allUsers) {
      IModelApp.settings.saveSetting(requestContext, settings, "SavedExtensions", settingName, true, undefined, undefined).catch((_err) => { });
    } else {
      IModelApp.settings.saveUserSetting(requestContext, settings, "SavedExtensions", settingName, true, undefined, undefined).catch((_err) => { });
    }
  }

  /** Adds an extension to settings to be opened by loadSavedExtensions.
   * @beta
   */
  public async removeSavedExtensions(requestContext: AuthorizedClientRequestContext, extensionName: string, allUsers: boolean, settingName: string) {
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

    const settings = settingsResult.setting as ExtensionSetting;

    // collect all the remaining extensions.
    const newSettings = new ExtensionSetting([]);
    for (const savedExtension of settings.extensions) {
      if (savedExtension.name !== extensionName) {
        newSettings.extensions.push(savedExtension);
      }
    }

    if (newSettings.extensions.length > 0) {
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

  /** @internal */
  public static detailsFromExtensionLoadResults(extensionName: string, results: ExtensionLoadResults, reportSuccess: boolean): { detailHTML: HTMLElement | undefined; detailStrings: string[] | undefined } {
    let problems: undefined | string[];
    if (results && "string" === typeof (results))
      problems = [results];
    else if (Array.isArray(results))
      problems = results;
    else if (reportSuccess)
      problems = [IModelApp.i18n.translate("iModelJs:ExtensionErrors.Success", { extensionName })];
    else
      return { detailHTML: undefined, detailStrings: undefined };

    // report load errors to the user.
    let allDetails: string = "";
    for (const thisMessage of problems) {
      allDetails = allDetails.concat("<span>", thisMessage, "<br>", "</span>");
    }
    const allDetailsFragment: any = document.createRange().createContextualFragment(allDetails);
    const allDetailsHtml: HTMLElement = document.createElement("span");
    allDetailsHtml.appendChild(allDetailsFragment);
    return { detailHTML: allDetailsHtml, detailStrings: problems };
  }
}

class SavedExtension {
  constructor(public name: string, public args?: string[]) { }
}

class ExtensionSetting {
  constructor(public extensions: SavedExtension[]) { }
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
        const returnVal = ExtensionAdmin.detailsFromExtensionLoadResults(result[0], result[1], true);
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
