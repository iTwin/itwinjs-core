/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Extensions
 */

// import { Extension, ExtensionLoader, ExtensionManifest, LocalExtensionProps, PendingExtension } from "./Extension";
import { IModelApp } from "../IModelApp";
import { ExtensionManifest, LocalExtensionProps } from "./Extension";
import { ExtensionLoader, ExtensionLoaderProps } from "./ExtensionLoader";

/** The Extensions loading system has 3 goals:
 *   1. Only fetch what is needed when it is required
 *      1. Load a manifest file
 *      2. Load the the main module when necessary
 *   2. Download the needed files from
 *
 * 3 ways to load an Extension into the system:
 *
 *  1. At build-time provide the function to load both the Extension Manifest and import the main module of the extension.
 *     The main module must contain the activate() function.
 *  2. A minimum set of ExtensionLoaderProps that provide enough information to get the manifest
 *
 * An Extension can be in 3 different states:
 *   - Known
 *      - The Extension Admin has the minimal information needed to fetch the manifest for the Extension.
 *        knows the Extension exists but has not yet loaded the manifest
 *   - Installed
 *      - The Extension has the full manifest loaded and can be executed on the activation events
 *   - Disabled
 *      - The Extension has the full manifest but is not currently enabled and will not be executed based on the
 *        activation events.
 */

type ResolveFunc = (() => Promise<any>);
// type RejectFunc = ((arg: Error) => void);

enum ActivationEvents {
  onStartupApp = "onStartupApp",
}

/** The Extension Admin controls the list of currently known, loaded and executing an Extension.
 * Handles the loading of Extensions and maintains a list of the currently loaded Extensions.
 *
 * On application startup, an initial list of Extensions is gathered by searching in known locations for
 *
 * @alpha
 */
export class ExtensionAdmin {
  /** The list of places to download an Extension.  */
  private _extensionLoaders: ExtensionLoader[] = [];

  /** Defines the set of extensions that are currently known and can be invoked during activation events.  */
  private _installedExtensions: Map<string, LocalExtensionProps> = new Map<string, LocalExtensionProps>();

  /**
    * Fired when an Extension has been added or removed.
    */
  // public readonly onInstallExtension = new BeEvent<(added: readonly ExtensionProps[], removed: readonly ExtensionProps[]) => void>();

  public onStartup = async () => {
    await this.activateExtensionEvents(ActivationEvents.onStartupApp);
  };

  public constructor() {
    IModelApp.onBeforeStartup.addListener(this.onStartup);
  }

  /** Adds an ExtensionLoader to the front of the list of extension loaders in use. Extension loaders will be invoked front to back.
   * By default, the list consists of public Extension Service context, unless disabled via props.
   * @param extensionLoader Extension loader to add
   */
  public addExtensionLoaderFront(extensionLoader: ExtensionLoader) {
    this._extensionLoaders.unshift(extensionLoader);
  }

  /** Adds an ExtensionLoader to the list of extension loaders in use.
    * By default, the list consists of public Extension Service context, unless disabled via props.
    * @param extensionLoader Extension loader to add
    */
  public addExtensionLoader(extensionLoader: ExtensionLoader) {
    this._extensionLoaders.push(extensionLoader);
  }

  /** Add an Extension to be bundled during compilation.
   * @param manifestLoader A function that loads the manifest file.
   * @param mainFunc The main function to be executed upon
   */
  public async addBuildExtension(manifestPromise: Promise<any>, mainFunc?: ResolveFunc): Promise<void> {
    const manifest = await this.getManifest(manifestPromise);
    this._installedExtensions.set(manifest.name, { manifest, mainFunc });
  }

  /** Loops over all enabled Extensions and triggers each one if the provided event is defined. */
  private async activateExtensionEvents(event: string) {
    for (const extension of this._installedExtensions.values()) {
      if (!extension.manifest.activationEvents)
        continue;
      for (const activationEvent of extension.manifest.activationEvents) {
        if (activationEvent === event) {
          this.execute(extension); // eslint-disable-line @typescript-eslint/no-floating-promises
        }
      }
    }
  }

  /** Resolves an import function provided for build-time Extensions that should return a valid
   * Extension Manifest.
   */
  private async getManifest(loader: Promise<any>): Promise<ExtensionManifest> {
    const raw = await loader;
    const manifest = this.parseManifest(raw);
    return manifest;
  }

  private async parseManifest(raw: unknown): Promise<ExtensionManifest> {
    try {
      if ("object" === typeof (raw))
        return raw as ExtensionManifest;
      if ("string" === typeof (raw))
        return JSON.parse(raw) as ExtensionManifest;
    } catch (err: any) { }
    throw new Error("Extension is invalid: package.json is not JSON.");
  }

  // Important: The Function constructor is used here to isolate the context in which the Extension javascript has access.
  // By using the Function constructor to create and then execute the extension it will only have access to two scopes:
  //  1. It's own function scope
  //  2. The global scope
  //
  // The global scope is important for an Extension as that is where the reference to the Extension Implementation is supplied
  // from the application side.
  private async execute(extension: LocalExtensionProps): Promise<void> {
    if (extension.mainFunc)
      return extension.mainFunc();
  }

}
