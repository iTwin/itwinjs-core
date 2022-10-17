/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { ExtensionManifest, ExtensionProvider } from "../Extension";
import { request, RequestOptions } from "../../request/Request";
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
    return loadScript(this._props.jsUrl);
  }

  /**
   * Attempts to fetch an extension's manifest (package.json) file.
   * Throws an error if the provided manifestUrl is not accessible.
   */
  public async getManifest(): Promise<ExtensionManifest> {
    const options: RequestOptions = { method: "GET" };
    const response = await request(this._props.manifestUrl, options);
    const data =
      response.body ||
      (() => {
        if (!response.text) throw new Error("Manifest file was empty.");
        return JSON.parse(response.text);
      })();
    return data;
  }
}
