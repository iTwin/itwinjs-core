/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type {
  ExtensionManifest,
  ExtensionProvider,
} from "../Extension";
import { loadScript } from "./ExtensionLoadScript";

/**
 * Required props for a remote extension provider
 * @alpha
 */
export interface RemoteExtensionProviderProps {
  /** URL where the extension entry point can be loaded from */
  jsUrl: string;
  /** URL where the manifest (package.json) can be loaded from */
  manifestUrl: string;
}

/**
 * Implements a "remote" extension.
 * Remote extensions are hosted on an external server.
 * The execute() and getManifest() methods are used by the ExtensionAdmin to load and execute the extension.
 * @alpha
 */
export class RemoteExtensionProvider implements ExtensionProvider {
  /** The name of the server where the extension is hosted. */
  public readonly hostname: string;

  constructor(private readonly _props: RemoteExtensionProviderProps) {
    this.hostname = new URL(this._props.jsUrl).hostname.replace("www", "");
  }

  /**
   * Attempts to execute an extension.
   * Throws an error if the provided jsUrl is not accessible.
   */
  public async execute(): Promise<string> {
    const doesUrlExist = await this._exists(this._props.jsUrl);
    if (!doesUrlExist) {
      throw new Error(`Extension at ${this._props.jsUrl} could not be found.`);
    }
    return loadScript(this._props.jsUrl);
  }

  /**
   * Attempts to fetch an extension's manifest (package.json) file.
   * Throws an error if the provided manifestUrl is not accessible.
   */
  public async getManifest(): Promise<ExtensionManifest> {
    const doesUrlExist = await this._exists(this._props.manifestUrl);
    if (!doesUrlExist) {
      throw new Error(`Manifest at ${this._props.manifestUrl} could not be found.`);
    }
    return (await fetch(this._props.manifestUrl)).json();
  }

  /** Checks if url actually exists */
  private async _exists(url: string): Promise<boolean> {
    let exists = false;
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
