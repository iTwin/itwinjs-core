/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { rcompare } from "semver";
import { ExtensionClient, ExtensionMetadata, ITwinOptions } from "@itwin/extension-client";

import { IModelApp } from "../../IModelApp";
import { request, RequestOptions } from "../../request/Request";
import { loadScript } from "./ExtensionLoadScript";

import type {
  ExtensionManifest, ExtensionProvider,
} from "../Extension";
import type { AccessToken } from "@itwin/core-bentley";

/**
 * Required props for an extension uploaded to Bentley's Extension Service
 * @alpha
 */
export interface ServiceExtensionProviderProps {
  /** Name of the uploaded extension */
  name: string;
  /** Version number (optional - if undefined, assumes the latest version) */
  version?: string;
  /** iTwin Id (optional - if undefined, assumes the extension is public) */
  iTwinId?: string;
  /** @internal */
  getAccessToken?: () => Promise<AccessToken>;
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

    const options: RequestOptions = { method: "GET" };
    const response = await request(loadedExtensionProps.manifest.url, options);
    const data = response.body || (() => {
      if (!response.text)
        throw new Error("Manifest file was empty.");
      return JSON.parse(response.text);
    })();
    return data;
  }

  /** Executes the javascript main file (the bundled index.js) of an extension from the Extension Service.
   * Throws an error if the file cannot be found.
   */
  public async execute(): Promise<any> {
    const loadedExtensionProps = await this._getExtensionFiles(this._props);
    if (!loadedExtensionProps)
      throw new Error(`Error executing Extension ${this._props.name}.`);

    return loadScript(loadedExtensionProps.main.url);
  }

  /** Fetches the extension from the ExtensionService.
   */
  private async _getExtensionFiles(props: ServiceExtensionProviderProps) {
    const extensionClient = new ExtensionClient();

    const accessToken = await (props.getAccessToken?.() ?? IModelApp.authorizationClient?.getAccessToken());
    if (!accessToken)
      return undefined;

    const iTwinId: ITwinOptions = props.iTwinId ? { id: props.iTwinId } : "public";

    let extensionProps: ExtensionMetadata | undefined;
    if (props.version !== undefined){
      const propsArr = await extensionClient.getExtensionsMetadata({accessToken, iTwinId, extensionName: props.name, version: props.version});
      extensionProps = propsArr[0];
    } else {
      const propsArr = await extensionClient.getExtensionsMetadata({accessToken, iTwinId, extensionName: props.name});
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
