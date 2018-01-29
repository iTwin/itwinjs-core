/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelError, IModelStatus } from "../common/IModelError";
    /* WIP this require breaks our react app's webpack build step
import { KnownLocations } from "./KnownLocations";
*/

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
      throw new IModelError(IModelStatus.BadRequest, "Addon version is (" + addonVer + "). imodeljs-backend requires version (" + iWasBuiltWithVer + ")");
    }
  }

  /** Get the module that can load the standard addon. */
  public static getStandardAddonLoaderModule(): any | undefined {
    if (typeof (process) === "undefined")
      return undefined;
    if ("electron" in process.versions) {
      return require("@bentley/imodeljs-electronaddon");
    }
    return require("@bentley/imodeljs-nodeaddon");
  }

  /** Load and register the standard addon. */
  public static loadAndRegisterStandardAddon() {

    /* WIP this require breaks our react app's webpack build step
    if (KnownLocations.imodeljsMobile !== undefined) {
      // We are running in imodeljs (our mobile platform)
      NodeAddonRegistry.registerAddon(require("@bentley/imodeljs-mobile"));
      return;
    }
    */

    if (typeof (process) === "undefined") {
      // We are running in an unknown platform.
      throw new IModelError(IModelStatus.NotFound);
    }

    // We are running in node or electron.
    const loaderModule = NodeAddonRegistry.getStandardAddonLoaderModule();
    if (loaderModule === undefined) {
      throw new IModelError(IModelStatus.NotFound);
    }
    NodeAddonRegistry.registerAddon(loaderModule.NodeAddonLoader.loadAddon());
  }
}

/** Utility class to help apps compute the name of the default addon package that should be used in the current environment.
 * Normally, only an Electron app should have to use this class.
 * NB: This class is NOT to be used directly by the backend. This class is implemented in backed only because that is where it can most conveniently be found and used by both apps and by nodeaddon.
 */
export class NodeAddonPackageName {

  /** Compute the name of default addon package that should be used for this environment. This method uses the same naming formula that is used by
   * the bb part that generates and publishes the default addon packages (iModelJsNodeAddon:MakePackages).
   */
  public static computeDefaultImodelNodeAddonPackageName(): string {

    // *** KEEP THIS CONSISTENT WITH iModelJsNodeAddon/MakePackages.py IN MERCURIAL ***

    if (typeof (process) === "undefined" || process.version === "")
      throw new IModelError(IModelStatus.BadRequest, "Could not determine process type");

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

  /** Compute the name of default addonthat should be used for this environment. This method uses the same naming formula that is used by
   * the bb part that generates and publishes the default addon packages (iModelJsNodeAddon:MakePackages).
   */
  public static computeDefaultImodelNodeAddonName(): string {
    return NodeAddonPackageName.computeDefaultImodelNodeAddonPackageName() + "/addon/imodeljs.node";
  }
}
