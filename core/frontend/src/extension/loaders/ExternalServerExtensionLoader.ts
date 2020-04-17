/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ExtensionLoader, PendingExtension } from "../Extension";

/** Reads the extension from a plain server assuming that the extension is a set of files in a directory formatted as "imjs_extensions/<extensionName>".
 * @beta
 */
export class ExternalServerExtensionLoader implements ExtensionLoader {

  public constructor(public serverName: string) { }

  public resolveResourceUrl(extensionName: string, relativeUrl: string): string {
    const relativeUrlWithSlash = relativeUrl.startsWith("/") ? relativeUrl : ("/" + relativeUrl);
    return new URL("imjs_extensions/".concat(extensionName, relativeUrlWithSlash), this.serverName).toString();
  }

  public getExtensionName(extensionRoot: string): string {
    const slashPos = extensionRoot.lastIndexOf("/");
    return extensionRoot.slice(slashPos + 1);
  }

  public async loadExtension(extensionName: string, _extensionVersion?: string, args?: string[]): Promise<PendingExtension | undefined> {
    // TODO: The entry point must be a "index.js" file at this point and no need for a manifest file.  All version checking is done in the Extensions bundle (i.e. "index.js")
    const jsFileUrl: string = this.resolveResourceUrl(extensionName, "/index.js");
    // check if the entry point exists
    try {
      const response = await fetch(jsFileUrl, { method: "HEAD" });
      if (response.status !== 200)
        return undefined;
    } catch (error) {
      return undefined;
    }
    // set it up to load.
    return new PendingExtension(jsFileUrl, this, args);
  }
}
