/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Logger } from "@bentley/bentleyjs-core";
import { IModelApp } from "../IModelApp";
import { ExtensionLoadResults } from "./ExtensionResults";
import { PendingExtension, Extension, ExtensionLoader, loggerCategory } from "./Extension";
import { ExtensionServiceExtensionLoader } from "./loaders/ExtensionServiceExtensionLoader";

/**
 * Describes configuration options to the ExtensionAdmin
 * @beta
 */
export interface ExtensionAdminProps {
  /** Whether or not to load Extensions from the Product Setting Service on the initialization of the ExtensionAdmin.
   *
   * Requires the `product-setting-service` OIDC scope.
   *
   * @beta
   */
  loadProductStartupExtensions?: boolean;
}

interface PriorityLoaderPair {
  priority: number;
  loader: ExtensionLoader;
}

/** Handles the loading of Extensions, and maintains a list of registered, currently loaded, and currently being downloaded extensions.
 *
 * Extensions are loaded asynchronously, leading to them being loaded in a different order than they are requested. To wait for a
 * given extension, await the PendingExtension.promise
 *
 * @beta
 */
export class ExtensionAdmin {
  private _extensionAdminProps?: ExtensionAdminProps;
  // private _bentleyExtensionServiceLoaderAdded: boolean = false;
  private _extensionLoaders: PriorityLoaderPair[] = [];
  private _pendingExtensions: Map<string, PendingExtension> = new Map<string, PendingExtension>();
  private _registeredExtensions: Map<string, Extension> = new Map<string, Extension>();
  private _viewStartupExtensionsLoaded: boolean = false;

  public constructor(props?: ExtensionAdminProps) {
    this._extensionAdminProps = props;
  }

  /** On view startup, [[IModelApp.viewManager.onViewOpen]], any saved extensions will be loaded.
   * @beta
   */
  public onInitialized() {
    if (this._extensionAdminProps && this._extensionAdminProps.loadProductStartupExtensions)
      IModelApp.viewManager.onViewOpen.addOnce(this.loadViewStartupExtensions.bind(this));

    // TODO: find default context id
    // TODO: Only load when specified, this should be the default
    this.addExtensionLoader(new ExtensionServiceExtensionLoader("00000000-0000-0000-0000-000000000000"), 100);
  }

  /** @internal */
  public addPendingExtension(extensionRootName: string, pendingExtension: PendingExtension) {
    const extensionNameLC = extensionRootName.toLowerCase();
    this._pendingExtensions.set(extensionNameLC, pendingExtension);
  }

  /**
   * Adds an ExtensionLoader to the list of extension loaders in use. Extension loaders will be invoked in the ascending order of priority.
   * By default, the list consists of Extension service with priority 100.
   * @param extensionLoader Extension loader to add
   * @param priority Priority to assign to the added extension loader
   *
   */
  public addExtensionLoader(extensionLoader: ExtensionLoader, priority: number) {
    this._extensionLoaders.push({
      loader: extensionLoader,
      priority,
    });
    this._extensionLoaders = this._extensionLoaders.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Loads an Extension using one of the available [[ExtensionLoader]]s that are registered on the [[ExtensionAdmin]].
   * @param extensionRoot the root name of the Extension to be loaded from the web server.
   * @param extensionVersion the version of the Extension to be loaded
   * @param args arguments that will be passed to the Extension.onLoaded and Extension.onExecute methods. If the first argument is not the extension name, the extension name will be prepended to the args array.
   */
  public async loadExtension(extensionRoot: string, extensionVersion?: string, args?: string[]): Promise<ExtensionLoadResults> {
    for (const loaderPriorityPair of this._extensionLoaders) {
      const extensionLoader = loaderPriorityPair.loader;
      const extensionName = extensionLoader.getExtensionName(extensionRoot);
      // make sure there's an args and make sure the first element is the extension name.
      if (!args) {
        args = [extensionName];
      } else if ((args.length < 1) || (args[0] !== extensionName)) {
        const newArray: string[] = [extensionName];
        args = newArray.concat(args);
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

      const pending: PendingExtension | undefined = await extensionLoader.loadExtension(extensionName, extensionVersion, args);
      if (pending === undefined)
        continue; // try another loader
      this.addPendingExtension(extensionNameLC, pending);
      // Return the promise of the pending plugin.
      return pending.promise;
    }
    return undefined;
  }

  /**
   * Registers an Extension with the ExtensionAdmin. This method is called by the Extension when it is first loaded.
   * This method verifies that the required versions of the iModel.js shared libraries are loaded. If those
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
    if (undefined === pendingExtension)
      throw new Error("Pending Extension not found.");

    pendingExtension.resolve!(extension);
    extension.loader = pendingExtension.loader;
    args = pendingExtension.args;

    if (!args)
      args = [extension.name];
    extension.onLoad(args);
    extension.onExecute(args);
    return undefined;
  }

  /** @internal */
  private async loadViewStartupExtensions(): Promise<void> {
    if (this._viewStartupExtensionsLoaded)
      return;
    if (!IModelApp.authorizationClient)
      return;
    const accessToken = await IModelApp.authorizationClient!.getAccessToken();
    if (!accessToken)
      return;
    this._viewStartupExtensionsLoaded = true;
    // const requestContext = new AuthorizedClientRequestContext(accessToken, "loadStartupExtension");
    // load user/app specific extensions.
    // const extensionsLoadResults: LoadSavedExtensionsResult = await this.loadSavedExtensions(requestContext, "StartViewExtensions");
    // extensionsLoadResults.report();
  }
}
