/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as semver from "semver";
import { ExtensionClient, ExtensionProps } from "@bentley/extension-client";
import { AuthorizedClientRequestContext } from "@bentley/imodeljs-clients";

import { ExtensionLoader, PendingExtension, LoadedExtensionProps } from "../Extension";
import { IModelApp } from "../../IModelApp";

/** Downloads extensions from Extension Service
 * @beta
 */
export class ExtensionServiceExtensionLoader implements ExtensionLoader {
  private _loadedExtensionProps: { [extensionName: string]: LoadedExtensionProps } = {};

  public constructor(private _contextId: string) { }

  public resolveResourceUrl(extensionName: string, relativeFileName: string): string {
    const loadedProps = this._loadedExtensionProps[extensionName];
    if (loadedProps === undefined) {
      throw new Error("Extension with given name hasn't been loaded");
    }

    const fullFileName = new URL(relativeFileName, loadedProps.basePath).toString();
    const fileNameWithKey = loadedProps.props.files.find((file) => file.url.startsWith(fullFileName + "?"))?.url;

    return fileNameWithKey ?? fullFileName;
  }

  public getExtensionName(extensionRoot: string): string {
    return extensionRoot;
  }

  // query Extension Service again for renewed ExtensionProps
  private async refreshExtensionProps(extensionName: string) {
    const loadedExtensionProps = this._loadedExtensionProps[extensionName];
    if (loadedExtensionProps === undefined)
      return;

    const newExtensionProps = await this.getExtensionProps(extensionName, loadedExtensionProps.props.version);
    if (newExtensionProps === undefined)
      // if it fails to get new props, retry in one minute
      setTimeout(this.refreshExtensionProps.bind(this), 60000, extensionName);
    else {
      this._loadedExtensionProps[extensionName] = newExtensionProps;
      this.schedulePropsRefresh(extensionName);
    }
  }

  // this will schedule an ExtensionProps refresh halfway to the expiry date
  private schedulePropsRefresh(extensionName: string) {
    const loadedExtensionProps = this._loadedExtensionProps[extensionName];
    if (loadedExtensionProps === undefined)
      return;

    const currTime = new Date().getTime();

    // extract expiry time from Azure Blob Storage URL
    const validUntil = loadedExtensionProps.props.files[0].expires;
    // Date constructor returns NaN for invalid strings
    if (isNaN(validUntil.getTime()))
      // if no expiry date is found, try again in one minute
      setTimeout(this.refreshExtensionProps.bind(this), 60000, extensionName);

    // schedule the next refresh halfway to the expiry date
    setTimeout(this.refreshExtensionProps.bind(this), (validUntil.getTime() - currTime) / 2, extensionName);
  }

  public async loadExtension(extensionName: string, extensionVersion?: string, args?: string[] | undefined): Promise<PendingExtension | undefined> {
    const loadedExtensionProps = await this.getExtensionProps(extensionName, extensionVersion);
    if (loadedExtensionProps === undefined)
      return undefined;

    this._loadedExtensionProps[extensionName] = loadedExtensionProps;

    const mainFilePath = new URL("index.js?", loadedExtensionProps.basePath).toString();
    const mainFile = loadedExtensionProps.props.files.find((file) => file.url.startsWith(mainFilePath));
    if (mainFile === undefined)
      return undefined;

    // file URLs will expire after some time, we need to refresh the ExtensionProps before that.
    this.schedulePropsRefresh(extensionName);

    return new PendingExtension(mainFile.url, this, args);
  }

  private async getExtensionProps(extensionName: string, extensionVersion?: string): Promise<LoadedExtensionProps | undefined> {
    const extensionClient = new ExtensionClient();

    const accessToken = await IModelApp.authorizationClient?.getAccessToken();
    if (!accessToken)
      return undefined;
    const requestContext = new AuthorizedClientRequestContext(accessToken);

    let extensionProps: ExtensionProps | undefined;
    if (extensionVersion !== undefined)
      extensionProps = await extensionClient.getExtensionProps(requestContext, this._contextId, extensionName, extensionVersion);
    else {
      const props = await extensionClient.getExtensions(requestContext, this._contextId, extensionName);
      const newestVersion = semver.rsort(props.map((ext) => ext.version))[0];
      extensionProps = props.find((ext) => ext.version === newestVersion);
    }

    if (extensionProps === undefined || extensionProps.files.length < 1)
      return undefined;

    const sortedUris = extensionProps.files.sort((a, b) => a.url.localeCompare(b.url));
    const firstUri = sortedUris[0].url;
    const lastUri = sortedUris[sortedUris.length - 1].url;
    let i = 0;
    while (i < firstUri.length && firstUri[i] === lastUri[i]) i++;
    while (i > 0 && firstUri[i] !== "/") i--;
    const relativePathStart = i + 1;
    const basePath = firstUri.slice(0, relativePathStart);

    return { props: extensionProps, basePath };
  }
}
