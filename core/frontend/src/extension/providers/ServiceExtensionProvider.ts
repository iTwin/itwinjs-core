/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { rcompare } from "semver";

import { IModelApp } from "../../IModelApp";
import { loadScript } from "./ExtensionLoadScript";
import { ExtensionClient, ExtensionMetadata } from "./ExtensionServiceClient";

import type {
  ExtensionManifest, ExtensionProvider,
} from "../Extension";

/**
 * Required props for an extension uploaded to Bentley's Extension Service
 * @alpha
 */
export interface ServiceExtensionProviderProps {
  /** Name of the uploaded extension */
  name: string;
  /** Version number (Semantic Versioning) */
  version: string;
  /** iTwin Id */
  iTwinId: string;
}

/**
 * Implements an Extension from the Extension Service via the ServiceExtensionProviderProps.
 * Service extensions are extensions hosted on Bentley's Extension Service.
 * The execute() and getManifest() methods are used by the ExtensionAdmin to load and execute the extension.
 * @alpha
 */
export class ServiceExtensionProvider implements ExtensionProvider {

  constructor(private readonly _props: ServiceExtensionProviderProps) { }

  /** Returns the extension's manifest (package.json) from the ExtensionService.
   * Throws an error if the manifest cannot be found.
   */
  public async getManifest(): Promise<ExtensionManifest> {
    const loadedExtensionProps = await this._getExtensionFiles(this._props);
    if (!loadedExtensionProps)
      throw new Error(`Error loading manifest for Extension ${this._props.name}.`);

    const doesUrlExist = await this._exists(loadedExtensionProps.manifest.url);
    if (!doesUrlExist)
      throw new Error(`Manifest at ${loadedExtensionProps.manifest.url} could not be found.`);

    return (await fetch(loadedExtensionProps.manifest.url)).json();
  }

  /** Executes the javascript main file (the bundled index.js) of an extension from the Extension Service.
   * Throws an error if the file cannot be found.
   */
  public async execute(): Promise<any> {
    const loadedExtensionProps = await this._getExtensionFiles(this._props);
    if (!loadedExtensionProps)
      throw new Error(`Error executing Extension ${this._props.name}.`);

    const doesUrlExist = await this._exists(loadedExtensionProps.main.url);
    if (!doesUrlExist)
      throw new Error(`Main javascript file at ${loadedExtensionProps.main.url} could not be found.`);

    return loadScript(loadedExtensionProps.main.url);
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

  /** Fetches the extension from the ExtensionService.
   */
  private async _getExtensionFiles(props: ServiceExtensionProviderProps) {
    const extensionClient = new ExtensionClient();

    const accessToken = await IModelApp.authorizationClient?.getAccessToken();
    if (!accessToken)
      return undefined;

    let extensionProps: ExtensionMetadata | undefined;
    if (props.version !== undefined)
      extensionProps = await extensionClient.getExtensionMetadata(accessToken, props.iTwinId, props.name, props.version);
    else {
      const propsArr = await extensionClient.getExtensions(accessToken, props.iTwinId, props.name);
      extensionProps = propsArr.sort((ext1, ext2) => rcompare(ext1.version, ext2.version, true))[0];
    }

    if (extensionProps === undefined || extensionProps.files.length < 1)
      return undefined;

    const manifest = extensionProps.files.find((f) => f.url.indexOf("package.json?") > -1);
    const main = extensionProps.files.find((f) => f.url.indexOf("index.js?") > -1);
    if (!manifest || !main)
      return undefined;

    return { manifest, main };
  }
}
