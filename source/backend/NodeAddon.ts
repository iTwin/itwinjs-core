/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// =============================================================================================
// NOTE: NodeAddonLoader must be kept in sync with the "scripts/install-imodeljs-addon.js" installation script
// =============================================================================================

import { IModelError, IModelStatus } from "../common/IModelError";

declare function require(arg: string): any;

/** Class that manages the singleton addon instance configured for this iModelJs session. */
export class NodeAddon {
  private static _addon: any;

  /** Return the singleton addon instance configured for this iModelJs session.
   * See [[NodeAddon.loadDefault]] and [[NodeAddon.load]]
   * @throws [[IModelError]] if the addon was not loaded.
   */
  public static getAddon(): any {
    if (!NodeAddon._addon)
      throw new IModelError(IModelStatus.FileNotLoaded, "Node addon not loaded");

    return NodeAddon._addon;
  }

  /** Loads the default/base addon
   * @param moduleRootDir The **node_modules** root directory
   * @throws [[IModeError]] if the addon cannot be found
   */
  public static loadDefault(moduleRootDir: string): void {
    if (typeof (process) === "undefined" || process.version === "")
      throw new IModelError(IModelStatus.BadRequest, "NodeAddonLoader could not determine process type");

    NodeAddon.load(moduleRootDir + NodeAddon.computePackageName() + "/addon/imodeljs.node");
  }

  /** Loads the addon using the specified path.
   * @param addonPath The full path to the addon library.
   * @throws [[IModeError]] if the addon cannot be found
   */
  public static load(addonPath: string): void {
    if (NodeAddon._addon)
      return;

    // tslint:disable-next-line:no-var-requires
    NodeAddon._addon = require(addonPath);
    if (!NodeAddon._addon)
      throw new IModelError(IModelStatus.FileNotFound, "Node Addon library not found: " + addonPath);

    if (NodeAddon._addon.setTickKicker)
      NodeAddon._addon.setTickKicker(() => { return; });
  }

  // Examples:
  // @bentley/imodeljs-n_8_2-winx64 1.0.44
  // @bentley/imodeljs-e_1_6_11-winx64 1.0.44
  private static computePackageName(): string {
    let versionCode;
    const electronVersion = (process.versions as any).electron;
    if (typeof electronVersion !== "undefined") {
      versionCode = "e_" + electronVersion.replace(/\./g, "_");
    } else {
      const nodeVersion = process.version.substring(1).split("."); // strip off the character 'v' from the start of the string
      versionCode = "n_" + nodeVersion[0] + "_" + nodeVersion[1]; // use only major and minor version numbers
    }
    return "@bentley/imodeljs-" + versionCode + "-" + NodeAddon.getPlatformDir();
  }

  private static getPlatformDir(): string {
    const arch = process.arch;
    if (process.platform === "win32") {
      return "win" + arch;
    }
    return process.platform + arch;
  }
}
