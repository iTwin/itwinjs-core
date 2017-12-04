/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { IModelError, IModelStatus } from "../common/IModelError";

declare function require(arg: string): any;

/** Loads the appropriate version of the default imodeljs-node addon. In order to use this class, an app must have an NPM dependency
 * on this package (imodeljs-nodeaddon). This package, in turn, depends on various versions of the default addon. When the app is NPM-installed,
 * these dependencies tell NPM which addon to download and install. NPM puts it into place in the node_modules/@bentley subdirectory.
 * That is why NodeAddonLoader does not take or compute a filepath to the addon - it just lets 'require' find the addon in node_modules in the usual way.
 */
export class NodeAddonLoader {
  private static _addon: any;

  /** Return the singleton addon instance configured for this iModelJs session.
   * See [[NodeAddon.lloadAddon]]
   * @throws [[IModelError]] if the addon was not loaded.
   */
  public static getAddon(): any {
    if (!NodeAddonLoader._addon)
      throw new IModelError(IModelStatus.FileNotLoaded, "Node addon not loaded");

    return NodeAddonLoader._addon;
  }

  /** Loads the appropriate version of the addon
   * @throws [[IModeError]] if the addon cannot be found
   */
  public static loadAddon(): any {
    const addonPath = NodeAddonLoader.computePackageName() + "/addon/imodeljs.node";
    // tslint:disable-next-line:no-var-requires
    NodeAddonLoader._addon = require(addonPath);
    if (!NodeAddonLoader._addon)
      throw new IModelError(IModelStatus.FileNotFound, "Node Addon library not found: " + addonPath);

    return NodeAddonLoader._addon;
  }

  // Examples:
  // *** KEEP THIS CONSISTENT WITH iModelJsNodeAddon/MakePackages.py IN MERCURIAL ***
  private static computePackageName(): string {

    if (typeof (process) === "undefined" || process.version === "")
      throw new IModelError(IModelStatus.BadRequest, "NodeAddonLoader could not determine process type");

    let versionCode;
    const electronVersion = (process.versions as any).electron;
    if (typeof electronVersion !== "undefined") {
      versionCode = "e_" + electronVersion.replace(/\./g, "_");
    } else {
      const nodeVersion = process.version.substring(1).split("."); // strip off the character 'v' from the start of the string
      versionCode = "n_" + nodeVersion[0] + "_" + nodeVersion[1]; // use only major and minor version numbers
    }
    return "@bentley/imodeljs-" + versionCode + "-" + process.platform + "-" + process.arch;
  }

}
