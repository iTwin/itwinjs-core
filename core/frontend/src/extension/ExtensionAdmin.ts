/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Extensions
 */

import { Extension, ExtensionManifest, ExtensionProvider } from "./Extension";

/** The Extensions loading system has the following goals:
 *   1. Only fetch what is needed when it is required
 *      1. Load a manifest file
 *      2. Load the the main module when necessary
 *   2. Download the extension's files
 *
 * 2 ways to load an Extension into the system:
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

/** The Extension Admin controls the list of currently known, loaded and executing an Extension.
 * Handles the loading of Extensions and maintains a list of the currently loaded Extensions.
 *
 * @alpha
 */
export class ExtensionAdmin {
  /** Defines the set of extensions that are currently known and can be invoked during activation events.  */
  private _extensions: Map<string, Extension> = new Map<string, Extension>();
  private _hosts: string[];

  /** Fired when an Extension has been added or removed.
   * @internal
   */
  public onStartup = async () => {
    await this.activateExtensionEvents("onStartup");
  };

  public constructor() {
    this._hosts = [];
  }

  /**
   * Register a local or remote extension
   * @param provider
   * @alpha
   */
  public async addExtension(provider: ExtensionProvider): Promise<void> {
    const manifest = await this.getManifest(provider);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { manifestPromise, manifestUrl, ...extensionContent } = provider;
    this._extensions.set(manifest.name, {
      manifest,
      ...extensionContent,
    });
  }

  /**
   * Register a list of local and/or remote extensions
   * @param providers
   * @alpha
   */
  public async addExtensions(providers: ExtensionProvider[]): Promise<void[]> {
    return Promise.all(
      providers.map(async (provider) => this.addExtension(provider))
    );
  }

  /**
   * Register a url (hostname) for extension hosting (i.e. https://localhost:3000, https://www.yourdomain.com, etc.)
   * @param hostUrl
   */
  public registerHost(hostUrl: string) {
    this._hosts.push(new URL(hostUrl).hostname.replace("www", ""));
  }

  /** Loops over all enabled Extensions and triggers each one if the provided event is defined. */
  private async activateExtensionEvents(event: string) {
    for (const extension of this._extensions.values()) {
      if (!extension.manifest.activationEvents) continue;
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
  private async getManifest(
    provider: ExtensionProvider
  ): Promise<ExtensionManifest> {
    let manifest: ExtensionManifest;
    if (provider.manifestPromise) {
      manifest = await provider.manifestPromise;
    } else if (provider.manifestUrl) {
      manifest = await (await fetch(provider.manifestUrl)).json();
    } else {
      throw new Error(
        "Please provide a method to retrieve the Extension manifest"
      );
    }
    return manifest;
  }

  // Important: The Function constructor is used here to isolate the context in which the Extension javascript has access.
  // By using the Function constructor to create and then execute the extension it will only have access to two scopes:
  //  1. It's own function scope
  //  2. The global scope
  //
  // The global scope is important for an Extension as that is where the reference to the Extension Implementation is supplied
  // from the application side.
  // TODO Are these comments accurate?
  private async execute(extension: Extension): Promise<void> {
    if (extension.main) return extension.main();
    if (extension.jsUrl) {
      const hostName = new URL(extension.jsUrl).hostname.replace("www", "");
      if (this._hosts.indexOf(hostName) < 0) {
        throw new Error(
          `Extension "${extension.manifest.name}" could not be loaded from "${hostName}". Please register the host for extension usage via the registerHost API`
        );
      }
      try {
        const main = await import(/* webpackIgnore: true */ extension.jsUrl);
        if (typeof main === "function") {
          return main();
        }
        if (!main.default) {
          throw new Error(
            `No default export was found in remote extension "${extension.manifest.name}"`
          );
        }
        return main.default();
      } catch(error) {
        throw new Error(`Failed to import an extension from ${extension.jsUrl}: ${error}`);
      }
    }
  }
}
