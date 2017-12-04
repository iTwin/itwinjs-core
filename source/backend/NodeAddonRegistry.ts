/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { IModelError, IModelStatus } from "../common/IModelError";

/** Class that holds the singleton addon instance that was loaded by the app for this iModelJs session. It is up to the app to load the addon. */
export class NodeAddonRegistry {
  private static _addon: any;

  /** Return the singleton addon instance configured for this iModelJs session.
   * See [[NodeAddonRegistry.registerAddon]]
   * @throws [[IModelError]] if the addon was not loaded.
   */
  public static getAddon(): any {
    if (!NodeAddonRegistry._addon)
      throw new IModelError(IModelStatus.FileNotLoaded, "Node addon not loaded");

    return NodeAddonRegistry._addon;
  }

  /** Call this function to register the addon */
  public static registerAddon(addon: any): void {
    NodeAddonRegistry._addon = addon;

    if (NodeAddonRegistry._addon)
      NodeAddonRegistry.checkAddonVersion();
  }

  private static parseSemVer(str: string): number[] {
    const c = str.split(".");
    return [parseInt(c[0], 10), parseInt(c[1], 10), parseInt(c[2], 10)];
  }

  private static checkAddonVersion(): void {
    const addonVer = NodeAddonRegistry._addon.version;
    // tslint:disable-next-line:no-var-requires
    const iWasBuiltWithVer = require("@bentley/imodeljs-nodeaddonapi/package.json").version;

    const addonVerDigits = NodeAddonRegistry.parseSemVer(addonVer);
    const iWasBuiltWithVerDigits = NodeAddonRegistry.parseSemVer(iWasBuiltWithVer);

    if ((addonVerDigits[0] !== iWasBuiltWithVerDigits[0]) || (addonVerDigits[1] < iWasBuiltWithVerDigits[1])) {
      NodeAddonRegistry._addon = undefined;
      throw new IModelError(IModelStatus.BadRequest, "Addon version is (" + addonVer + "). imodeljs-core requires version (" + iWasBuiltWithVer + ")");
    }
  }

}
