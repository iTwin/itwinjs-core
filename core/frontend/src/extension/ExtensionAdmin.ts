/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Extensions
 */

import { BeEvent, Logger } from "@bentley/bentleyjs-core";
import { Extension, ExtensionLoader, loggerCategory, PendingExtension } from "./Extension";
import { ExtensionServiceExtensionLoader } from "./loaders/ExtensionServiceExtensionLoader";

/**
 * Describes configuration options to the ExtensionAdmin
 * @beta
 */
export interface ExtensionAdminProps {
  /** Whether or not to configure Extension Service by default.
   *
   * Requires the `imodel-extension-service-api` OIDC scope.
   *
   * @beta
   */
  configureExtensionServiceLoader?: boolean;
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
  private _extensionLoaders: ExtensionLoader[] = [];
  private _pendingExtensions: Map<string, PendingExtension> = new Map<string, PendingExtension>();
  private _registeredExtensions: Map<string, Extension> = new Map<string, Extension>();

  /**
   * Fired when an extension has finished loading and is ready to use.
   */
  public readonly onExtensionLoaded = new BeEvent<(extensionName: string) => void>();

  public constructor(props?: ExtensionAdminProps) {
    this._extensionAdminProps = props;
  }

  /** On view startup, [[IModelApp.viewManager.onViewOpen]], [[ExtensionAdmin]] will be setup according to the provided [[ExtensionAdminProps]].
   * @beta
   */
  public onInitialized() {
    if (this._extensionAdminProps?.configureExtensionServiceLoader ?? true)
      this.addExtensionLoaderFront(new ExtensionServiceExtensionLoader("00000000-0000-0000-0000-000000000000"));
  }

  /** @internal */
  public addPendingExtension(extensionRootName: string, pendingExtension: PendingExtension) {
    const extensionNameLC = extensionRootName.toLowerCase();
    this._pendingExtensions.set(extensionNameLC, pendingExtension);
  }

  /**
   * Adds an ExtensionLoader to the front of the list of extension loaders in use. Extension loaders will be invoked front to back.
   * By default, the list consists of public Extension Service context, unless disabled via props.
   * @param extensionLoader Extension loader to add
   */
  public addExtensionLoaderFront(extensionLoader: ExtensionLoader) {
    this._extensionLoaders.unshift(extensionLoader);
  }

  /**
   * Adds an ExtensionLoader to the list of extension loaders in use.
   * By default, the list consists of public Extension Service context, unless disabled via props.
   * @param extensionLoader Extension loader to add
   */
  public addExtensionLoader(extensionLoader: ExtensionLoader) {
    this._extensionLoaders.push(extensionLoader);
  }

  /**
   * Loads an Extension using one of the available [[ExtensionLoader]]s that are registered on the [[ExtensionAdmin]].
   * If the Extension has already been loaded, [[Extension.onExecute]] will be called instead.
   * @param extensionRoot the root name of the Extension to be loaded from the web server.
   * @param extensionVersion the version of the Extension to be loaded
   * @param args arguments that will be passed to the [[Extension.onLoaded]] and [[Extension.onExecute]] methods. If the first argument is not the extension name, the extension name will be prepended to the args array.
   * @returns Promise that resolves to an Extension as soon as the extension has started loading. Note that this does not mean the extension is ready to use, see [[ExtensionAdmin.onExtensionLoaded]] instead.
   */
  public async loadExtension(extensionRoot: string, extensionVersion?: string, args?: string[]): Promise<Extension | undefined> {
    for (const extensionLoader of this._extensionLoaders) {
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
          try {
            await registeredExtension.onExecute(args);
          } catch (err) {
            if (err instanceof Error) {
              Logger.logError(loggerCategory, err.message);
            }
          }
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
   */
  public register(extension: Extension) {
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

    extension.onLoad(args)
      .then(async () => {
        await extension.onExecute(args!);
        this.onExtensionLoaded.raiseEvent(extension.name);
      })
      .catch((err) => {
        if (err instanceof Error) {
          Logger.logError(loggerCategory, err.message);
        }
      });
  }
}
