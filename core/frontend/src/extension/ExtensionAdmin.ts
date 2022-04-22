/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Extensions
 */

import { Extension, ExtensionProvider, LocalExtensionProvider, RemoteExtensionProvider } from "./Extension";

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
  public async addExtension(provider: LocalExtensionProvider | RemoteExtensionProvider): Promise<void> {
    if (provider instanceof RemoteExtensionProvider) {
      const hostName = provider.hostname;
      if (this._hosts.indexOf(hostName) < 0) {
        // TODO throw error if hostname wasn't registered ?
        // (DR can register the hostname of the iframe's parent as valid)
        // throw new Error(
        //   `Remote extension could not be loaded from "${hostName}". Please register the host for extension usage via the registerHost API`
        // );
      }
    }
    const { manifestPromise } = provider;
    const manifest = await manifestPromise;
    this._extensions.set(manifest.name, {
      manifest,
      provider,
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
    const url = new URL(hostUrl).hostname.replace("www", "");
    if (this._hosts.indexOf(url) < 0) {
      this._hosts.push(url);
    }
  }

  /** Loops over all enabled Extensions and triggers each one if the provided event is defined. */
  private async activateExtensionEvents(event: string) {
    for (const extension of this._extensions.values()) {
      if (!extension.manifest.activationEvents) continue;
      for (const activationEvent of extension.manifest.activationEvents) {
        if (activationEvent === event) {
          extension.provider.main(); // eslint-disable-line @typescript-eslint/no-floating-promises
        }
      }
    }
  }
}
