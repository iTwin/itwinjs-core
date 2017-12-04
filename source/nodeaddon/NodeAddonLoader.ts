/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { IModelError, IModelStatus } from "../common/IModelError";
import { NodeAddonPackageName } from "../backend/NodeAddonRegistry";

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
    const addonPath = NodeAddonPackageName.computeDefaultImodelNodeAddonName();
    // tslint:disable-next-line:no-var-requires
    NodeAddonLoader._addon = require(addonPath);
    if (!NodeAddonLoader._addon)
      throw new IModelError(IModelStatus.FileNotFound, "Node Addon library not found: " + addonPath);

    return NodeAddonLoader._addon;
  }

}
