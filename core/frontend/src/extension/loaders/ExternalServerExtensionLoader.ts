/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Extensions
 */

import { ExtensionLoader, PendingExtension } from "../Extension";

/** Reads the extension from a plain server assuming that the extension is a set of files in a directory formatted as:
 * - "imjs_extensions/<extensionVersion>/<extensionName>" if version is provided to [[loadExtension]]
 * - "imjs_extensions/<extensionName>" if version is _not_ provided to [[loadExtension]].
 * @beta
 */
export class ExternalServerExtensionLoader implements ExtensionLoader {

  private _loadedVersions: Map<string, string | undefined> = new Map<string, string | undefined>();

  public constructor(public serverName: string) { }

  public resolveResourceUrl(extensionName: string, relativeUrl: string): string {
    const relativeUrlWithSlash = relativeUrl.startsWith("/") ? relativeUrl : ("/" + relativeUrl);
    const version = this._loadedVersions.get(extensionName);
    const nameSegment = version === undefined ? extensionName : (extensionName + "/" + version);
    return new URL("imjs_extensions/".concat(nameSegment, relativeUrlWithSlash), this.serverName).toString();
  }

  public getExtensionName(extensionRoot: string): string {
    const parts = extensionRoot.split("/");

    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i] !== "")
        return parts[i];
    }
    return extensionRoot;
  }

  public async loadExtension(extensionName: string, extensionVersion?: string, args?: string[]): Promise<PendingExtension | undefined> {
    // TODO: The entry point must be a "index.js" file at this point and no need for a manifest file.  All version checking is done in the Extensions bundle (i.e. "index.js")
    const jsFileUrl: string = this.resolveResourceUrl(extensionName, extensionVersion === undefined ? "index.js" : (extensionVersion + "/index.js"));
    // check if the entry point exists
    try {
      const response = await fetch(jsFileUrl, { method: "HEAD" });
      if (response.status !== 200)
        return undefined;
    } catch (error) {
      return undefined;
    }
    this._loadedVersions.set(extensionName, extensionVersion);
    // set it up to load.
    return new PendingExtension(jsFileUrl, this, args);
  }
}
