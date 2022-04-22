/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Extensions
 */

/**
 * @alpha
 */
export type ActivationEvent = "onStartup";

/**
 * @alpha
 */
export type ResolveFunc = () => Promise<any>;

/** Defines the format of an Extension manifest
 * @alpha
 */
export interface ExtensionManifest {
  /** The extension name */
  readonly name: string;
  /** The extension display name */
  readonly displayName?: string;
  /** The extension version */
  readonly version: string;
  /** The extension description */
  readonly description?: string;
  /** The main module file to load. This should be a path to the javascript file
   * e.g "./lib/main.js"
   */
  readonly main: string;
  /** Only valid when the Extension is loaded at build-time.
   *
   * Defines the main ES module that will be imported
   */
  readonly module?: string;
  /** List of activation events this Extension supports. */
  readonly activationEvents: ActivationEvent[];
}

/**
 * A "ready to use" Extension (contains a manifest object).
 * Will be used as the type for in-memory extensions in the ExtensionAdmin
 * @alpha
 */
export interface Extension {
  provider: LocalExtensionProvider | RemoteExtensionProvider;
  manifest: ExtensionManifest;
}

/**
 * Required methods and properties of an ExtensionProvider.
 * @alpha
 */
export interface ExtensionProvider {
  /** returns the extension's manifest file */
  manifestPromise: Promise<ExtensionManifest>;
  /** runs the main entry point of the extension */
  main: ResolveFunc;
}

/** Required props for a local extension provider */
export interface LocalExtensionProviderProps {
  // TODO is there a better way of getting the manifest activation events compatible with literal string type?
  manifestPromise: Promise<any>;
  /** runs the main entry point of the extension */
  main: ResolveFunc;
}

/** Required props for a remote extension provider */
export interface RemoteExtensionProviderProps {
  /** URL where the extension entry point can be loaded from */
  jsUrl: string;
  /** URL where the manifest (package.json) can be loaded from */
  manifestUrl: string;
}

/**
 * Implements a "local" extension via LocalExtensionProps.
 * The methods are used by the ExtensionAdmin to call and load various extension types.
 */
export class LocalExtensionProvider implements ExtensionProvider {
  /**
   * A local promise that resolves the manifest.
   */
  public readonly manifestPromise: Promise<ExtensionManifest>;
  /**
   * A local function that is the starting execution point for the Extension.
   */
  public readonly main: ResolveFunc;

  constructor(props: LocalExtensionProviderProps) {
    this.manifestPromise = props.manifestPromise as Promise<ExtensionManifest>;
    this.main = props.main;
  }
}

/**
 * Implements a "remote" extension via LocalExtensionProps.
 * The methods are used by the ExtensionAdmin to call and load various extension types.
 */
export class RemoteExtensionProvider implements ExtensionProvider {
  /**
   * A local promise that resolves the manifest.
   */
  public readonly manifestPromise: Promise<ExtensionManifest>;
  /**
   * A local function that is the starting execution point for the Extension.
   */
  public readonly main: ResolveFunc;
  /**
   * A local function that is the starting execution point for the Extension.
   */
  public readonly hostname: string;

  constructor(props: RemoteExtensionProviderProps) {
    this.hostname = this._extractHostname(props.jsUrl);
    this.manifestPromise = this._getManifest(props.manifestUrl);
    this.main = this._getMainEntryPoint(props.jsUrl);
  }

  private _extractHostname(jsUrl: string) {
    return new URL(jsUrl).hostname.replace("www", "");
  }

  private _getMainEntryPoint(jsUrl: string): ResolveFunc {
    return async () => {
      const doesUrlExist = await this._exists(jsUrl);
      if (!doesUrlExist) {
        throw new Error(`Extension at ${jsUrl} could not be found.`);
      }
      return this._loadScript(jsUrl);
    };
  }

  private async _loadScript(jsUrl: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const head = document.getElementsByTagName("head")[0];
      if (!head)
        reject(new Error("no head element found"));
      const scriptElement = document.createElement("script");
      scriptElement.onerror = reject;
      scriptElement.onload = resolve;
      scriptElement.async = true;
      scriptElement.src = jsUrl;
      head.insertBefore(scriptElement, head.lastChild);
    });
  }

  private async _getManifest(manifestUrl: string): Promise<ExtensionManifest> {
    const doesUrlExist = await this._exists(manifestUrl);
    if (!doesUrlExist) {
      throw new Error(`Manifest at ${manifestUrl} could not be found.`);
    }
    return (await fetch(manifestUrl)).json();
  }

  /** check if url actually exists */
  private async _exists(url: string): Promise<boolean> {
    let exists = false;
    // check if the entry point exists
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.status === 200)
        exists = true;
    } catch (error) {
      exists = false;
    }
    return exists;
  }
}
