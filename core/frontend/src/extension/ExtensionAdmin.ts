/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Extensions
 */

import { Logger } from "@itwin/core-bentley";

import { FrontendLoggerCategory } from "../FrontendLoggerCategory";
import type { ExtensionManifest, ExtensionProvider } from "./Extension";

/** The Extensions loading system has the following goals:
 *   1. Only fetch what is needed when it is required
 *      1. Load a manifest file
 *      2. Load the the main module when necessary (usually at an activation event)
 *   2. Download the extension's files
 *
 * 3 ways to load an Extension into the system:
 *
 *  1. Load both the Extension Manifest and import the main module of the extension from a local file/package.
 *  2. A minimum set of properties to get the manifest and javascript from a remote server.
 *  3. A minimum set of properties to get the manifest and javascript from Bentley's Extension Service.
 *
 * An Extension must be added to ExtensionAdmin before it can be executed during activation events.
 */

/**
 * A "ready to use" Extension (contains a manifest object and an extension provider to help execute).
 * Will be used as the type for in-memory extensions in the ExtensionAdmin
 */
interface InstalledExtension {
  /** An extension provider that has been added to ExtensionAdmin */
  provider: ExtensionProvider;
  /** The manifest (package.json) of the extension */
  manifest: ExtensionManifest;
}

/** The Extension Admin controls the list of currently loaded Extensions.
 *
 * @alpha
 */
export class ExtensionAdmin {
  /** Defines the set of extensions that are currently known and can be invoked during activation events.  */
  private _extensions: Map<string, InstalledExtension> = new Map<string, InstalledExtension>();
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
   * Adds an extension.
   * The manifest will be fetched and the extension will be activated on an activation event.
   * @param provider
   * @alpha
   */
  public async addExtension(provider: ExtensionProvider): Promise<void> {
    if (provider.hostname) {
      const hostName = provider.hostname;
      if (this._hosts.length > 0 && this._hosts.indexOf(hostName) < 0) {
        throw new Error(`Error loading extension: ${hostName} was not registered.`);
      }
    }
    try {
      const manifest = await provider.getManifest();
      this._extensions.set(manifest.name, {
        manifest,
        provider,
      });
      // TODO - temporary fix to execute the missed startup event
      if (manifest.activationEvents.includes("onStartup"))
        provider.execute(); // eslint-disable-line @typescript-eslint/no-floating-promises
    } catch (e) {
      throw new Error(`Failed to get manifest from extension: ${e}`);
    }
  }

  /**
   * Adds a list of extensions
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
          this._execute(extension); // eslint-disable-line @typescript-eslint/no-floating-promises
        }
      }
    }
  }

  /** Executes the extension. Catches and logs any errors (so that an extension will not crash the main application). */
  private async _execute(extension: InstalledExtension) {
    try {
      await extension.provider.execute();
    } catch (e) {
      Logger.logError(FrontendLoggerCategory.Extensions, `Error executing extension ${extension.manifest.name}: ${e}`);
    }
  }
}
